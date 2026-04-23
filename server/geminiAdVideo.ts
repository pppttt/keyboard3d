import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { Video } from "@google/genai";
import type { Plugin } from "vite";

const API_PATH = "/api/gemini-ad-video";
const MAX_BODY_BYTES = 42 * 1024 * 1024;
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 90;

type GeminiAdVideoRequest = {
  imageBase64?: string;
  mimeType?: string;
  prompt?: string;
};

export function geminiAdVideoPlugin(): Plugin {
  return {
    name: "gemini-ad-video-api",
    configureServer(server) {
      server.middlewares.use(API_PATH, async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed." });
          return;
        }

        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            sendJson(res, 500, { error: "Missing GEMINI_API_KEY environment variable." });
            return;
          }

          const body = (await readJsonBody(req)) as GeminiAdVideoRequest;
          const imageBase64 = normalizeImageBase64(body.imageBase64);
          if (!imageBase64) {
            sendJson(res, 400, { error: "imageBase64 is required." });
            return;
          }

          const ai = new GoogleGenAI({ apiKey });
          let operation = await ai.models.generateVideos({
            model: "veo-3.1-generate-preview",
            prompt: body.prompt?.trim() || defaultAdVideoPrompt(),
            image: {
              imageBytes: imageBase64,
              mimeType: body.mimeType || "image/png",
            },
            config: {
              aspectRatio: "16:9",
              resolution: "720p",
              durationSeconds: 8,
              numberOfVideos: 1,
              enhancePrompt: true,
              generateAudio: false,
              negativePrompt: "text overlays, captions, logos, watermark, extra keyboards, warped keys, unreadable key legends, low quality, flicker",
            },
          });

          for (let poll = 0; !operation.done && poll < MAX_POLLS; poll += 1) {
            await delay(POLL_INTERVAL_MS);
            operation = await ai.operations.getVideosOperation({ operation });
          }

          if (!operation.done) {
            sendJson(res, 504, { error: "Gemini video generation timed out." });
            return;
          }
          if (operation.error) {
            sendJson(res, 502, { error: JSON.stringify(operation.error) });
            return;
          }

          const video = operation.response?.generatedVideos?.[0]?.video;
          if (!video) {
            sendJson(res, 502, { error: "Gemini did not return a video." });
            return;
          }

          const videoBytes = video.videoBytes ? Buffer.from(video.videoBytes, "base64") : await downloadGeneratedVideo(ai, video);
          res.statusCode = 200;
          res.setHeader("Content-Type", video.mimeType || "video/mp4");
          res.setHeader("Content-Disposition", `attachment; filename="keyboard-gemini-ad-${Date.now()}.mp4"`);
          res.end(videoBytes);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(res, 500, { error: message || "Gemini video generation failed." });
        }
      });
    },
  };
}

function defaultAdVideoPrompt() {
  return [
    "Create a premium cinematic product advertisement video from this rendered mechanical keyboard image.",
    "Use a smooth 45-degree studio camera push-in with subtle parallax over the flat keyboard layout.",
    "Keep the keyboard design, key positions, colors, legends, and artwork accurate and readable.",
    "Use refined three-point studio lighting, soft background atmosphere, shallow cinematic depth, realistic reflections, and polished commercial product pacing.",
    "No text overlay, no logo overlay, no hands, no people, no extra objects.",
  ].join(" ");
}

function normalizeImageBase64(value: string | undefined) {
  if (!value) return "";
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").trim();
}

async function downloadGeneratedVideo(ai: GoogleGenAI, video: Video) {
  const dir = join(tmpdir(), "keycaptest-gemini-video");
  await mkdir(dir, { recursive: true });
  const outputPath = join(dir, `${randomUUID()}.mp4`);
  try {
    await ai.files.download({ file: video, downloadPath: outputPath });
    return await readFile(outputPath);
  } finally {
    await rm(outputPath, { force: true });
  }
}

function readJsonBody(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
