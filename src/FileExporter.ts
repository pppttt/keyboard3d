import { profiles, type SceneConfig } from "./keycap";
import type { ParsedKey } from "./utils/KLEParser";

export type ProjectionLayer = {
  id: string;
  name: string;
  image: HTMLImageElement;
  sourceDataUrl?: string;
  sourceMime?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

export type ExportProjectInput = {
  mode: "preset" | "custom";
  presetId: string;
  layoutPath: string;
  config: SceneConfig;
  layers: ProjectionLayer[];
  projectionCanvas: HTMLCanvasElement | null;
};

export class FileExporter {
  static async exportProjectZip(input: ExportProjectInput) {
    return exportProjectZip(input);
  }

  static timestampForFile() {
    return timestampForFile();
  }
}

async function exportProjectZip(input: ExportProjectInput) {
  const imageFiles = await Promise.all(
    input.layers.map(async (layer, index) => {
      const image = await layerImageBytes(layer);
      const extension = extensionFromMime(image.mime, layer.name);
      const path = `assets/images/${String(index + 1).padStart(2, "0")}-${safeFileBase(layer.name)}.${extension}`;
      return { layer, image, path };
    }),
  );
  const transferSheet = await createHeatTransferSheet(input.config, input.projectionCanvas);
  const faceCuts = await createHeatTransferFaceCuts(input.config, input.projectionCanvas);
  const theme = createThemeJson(input);

  const project = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "keyboard3d",
    mode: input.mode,
    presetId: input.presetId,
    layoutPath: input.layoutPath,
    config: exportableConfig(input.config),
    theme: {
      file: "theme.json",
      schemaVersion: theme.schemaVersion,
      name: theme.name,
    },
    heatTransferSheet: {
      file: "production/heat-transfer-sheet.png",
      dpi: HEAT_TRANSFER_DPI,
      pxPerMm: HEAT_TRANSFER_PX_PER_MM,
      keySpacingMm: HEAT_TRANSFER_KEY_SPACING_MM,
      sizePx: { width: transferSheet.canvas.width, height: transferSheet.canvas.height },
      sizeMm: {
        width: transferSheet.canvas.width / HEAT_TRANSFER_PX_PER_MM,
        height: transferSheet.canvas.height / HEAT_TRANSFER_PX_PER_MM,
      },
      layout: transferSheet.layout,
    },
    heatTransferFaces: {
      directory: "production/key-faces",
      dpi: HEAT_TRANSFER_DPI,
      pxPerMm: HEAT_TRANSFER_PX_PER_MM,
      files: faceCuts.map(({ data, ...face }) => face),
    },
    projectionLayers: imageFiles.map(({ layer, image, path }) => ({
      id: layer.id,
      name: layer.name,
      file: path,
      mime: image.mime,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      rotationDegrees: (layer.rotation * 180) / Math.PI,
      opacity: layer.opacity,
      naturalWidth: layer.image.naturalWidth,
      naturalHeight: layer.image.naturalHeight,
    })),
  };

  const encoder = new TextEncoder();
  return createZip([
    { path: "project.json", data: encoder.encode(JSON.stringify(project, null, 2)) },
    { path: "theme.json", data: encoder.encode(JSON.stringify(theme, null, 2)) },
    { path: "production/heat-transfer-sheet.png", data: transferSheet.png },
    ...faceCuts.map(({ path, data }) => ({ path, data })),
    ...imageFiles.map(({ image, path }) => ({ path, data: image.data })),
  ]);
}

function exportableConfig(config: SceneConfig) {
  const { skinImage, projectionCanvas, projectionVersion, ...rest } = config;
  void skinImage;
  void projectionCanvas;
  void projectionVersion;
  return rest;
}

function createThemeJson(input: ExportProjectInput) {
  const { config } = input;
  const keys = config.layoutKeys;
  return {
    schemaVersion: 1,
    kind: "keyboard3d-theme",
    name: `${input.presetId || "custom"}-${timestampForFile()}`,
    exportedAt: new Date().toISOString(),
    source: {
      app: "keyboard3d",
      mode: input.mode,
      presetId: input.presetId,
      layoutPath: input.layoutPath,
    },
    defaults: {
      keycap: {
        color: config.keycapColor,
        material: config.keycapMaterial,
      },
      legend: {
        font: config.legendFont,
        color: config.legendColor,
        scale: config.legendScale,
        positions: legendPositionMap(),
      },
      icon: {
        position: 4,
        positionName: legendPositionName(4),
        scale: 1,
      },
      case: {
        color: config.caseConfig.color,
        material: config.caseConfig.material,
      },
    },
    keys: keys.map((key, keyIndex) => {
      const override = config.keyOverrides[keyIndex] ?? {};
      const labels = override.labels ?? key.labels ?? [];
      const iconPosition = override.iconPosition ?? 4;
      return {
        index: keyIndex,
        id: keyIdForTheme(key, keyIndex),
        label: resolveExportKeyLabel(key, override),
        layout: {
          x: key.x,
          y: key.y,
          w: key.w,
          h: key.h,
          row: key.profileRow,
          rotation: key.r ?? 0,
        },
        keycap: {
          color: override.color ?? key.color ?? config.keycapColor,
          material: override.material ?? config.keycapMaterial,
          overrideColor: override.color ?? null,
          overrideMaterial: override.material ?? null,
        },
        legend: {
          labels,
          font: override.legendFont ?? config.legendFont,
          color: override.legendColor ?? config.legendColor,
          scale: override.legendScale ?? config.legendScale,
          overrideFont: override.legendFont ?? null,
          overrideColor: override.legendColor ?? null,
          overrideScale: override.legendScale ?? null,
          slots: labels.map((label, slot) => {
            const [x, y] = EXPORT_LEGEND_POSITIONS[slot] ?? EXPORT_LEGEND_POSITIONS[4];
            return {
              slot,
              label,
              x,
              y,
              name: legendPositionName(slot),
              sourceColor: key.textColors[slot] ?? key.textColor ?? null,
              sourceSize: key.textSizes[slot] ?? key.textSize ?? null,
            };
          }),
        },
        icon: {
          imageUrl: override.iconImageUrl ?? "",
          position: iconPosition,
          positionName: legendPositionName(iconPosition),
          scale: override.iconScale ?? 1,
        },
      };
    }),
  };
}

function keyIdForTheme(key: ParsedKey, keyIndex: number) {
  const label = resolveExportKeyLabel(key, undefined);
  return `${String(keyIndex + 1).padStart(3, "0")}-${safeFileBase(label)}`;
}

function legendPositionMap() {
  return EXPORT_LEGEND_POSITIONS.map(([x, y], slot) => ({
    slot,
    name: legendPositionName(slot),
    x,
    y,
  }));
}

function legendPositionName(slot: number) {
  const names = [
    "top-left",
    "top",
    "top-right",
    "left",
    "center",
    "right",
    "bottom-left",
    "bottom",
    "bottom-right",
    "front-left",
    "front",
    "front-right",
  ];
  return names[slot] ?? "center";
}

const KEY_UNIT_MM = 19.05;
const HEAT_TRANSFER_DPI = 300;
const HEAT_TRANSFER_PX_PER_MM = HEAT_TRANSFER_DPI / 25.4;
const HEAT_TRANSFER_KEY_SPACING_MM = 5;
const HEAT_TRANSFER_BLEED_PX = 2;
const HEAT_TRANSFER_FACE_JOIN_OVERLAP_PX = 6;
const CANVAS_ENCODE_TIMEOUT_MS = 3000;
const IMAGE_DECODE_TIMEOUT_MS = 5000;
const DATA_URL_CANVAS_PIXEL_LIMIT = 4_000_000;

type HeatTransferFaceName = "top" | "back" | "front" | "left" | "right";

type HeatTransferTile = {
  key: ParsedKey;
  topW: number;
  topH: number;
  sideX: number;
  sideY: number;
  projectedBottomW: number;
  projectedBottomH: number;
  projectedInsetX: number;
  projectedInsetY: number;
};

type HeatTransferSourceRect = {
  sourceX: number;
  sourceY: number;
  sourceW: number;
  sourceH: number;
};

type HeatTransferFrame = {
  minX: number;
  minY: number;
  frameW: number;
  frameH: number;
};

async function createHeatTransferSheet(config: SceneConfig, projectionCanvas: HTMLCanvasElement | null) {
  const keys = config.layoutKeys;
  if (!keys.length) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return { canvas, png: await canvasToPngBytes(canvas), layout: [] };
  }

  const minX = Math.min(...keys.map((key) => key.x));
  const minY = Math.min(...keys.map((key) => key.y));
  const maxX = Math.max(...keys.map((key) => key.x + key.w));
  const maxY = Math.max(...keys.map((key) => key.y + key.h));
  const frameW = Math.max(1, maxX - minX);
  const frameH = Math.max(1, maxY - minY);
  const spacingPx = Math.round(HEAT_TRANSFER_KEY_SPACING_MM * HEAT_TRANSFER_PX_PER_MM);
  const paddingPx = spacingPx;

  const rows = groupKeysForTransfer(keys);
  const tiles = rows.map((row) =>
    row.map((key) => heatTransferTileForKey(config, key)),
  );

  const rowSizes = tiles.map((row) => ({
    width: row.reduce((sum, tile, index) => sum + tile.sideX * 2 + tile.topW + (index ? spacingPx : 0), 0),
    height: Math.max(...row.map((tile) => tile.sideY * 2 + tile.topH)),
  }));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, paddingPx * 2 + Math.max(...rowSizes.map((row) => row.width)));
  canvas.height = Math.max(1, paddingPx * 2 + rowSizes.reduce((sum, row, index) => sum + row.height + (index ? spacingPx : 0), 0));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, png: await canvasToPngBytes(canvas), layout: [] };
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const layout: Array<Record<string, unknown>> = [];
  let cursorY = paddingPx;
  for (let rowIndex = 0; rowIndex < tiles.length; rowIndex += 1) {
    const row = tiles[rowIndex];
    let cursorX = paddingPx;
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const tile = row[columnIndex];
      const tileW = tile.sideX * 2 + tile.topW;
      const tileH = tile.sideY * 2 + tile.topH;
      await drawHeatTransferTile(ctx, projectionCanvas, tile, cursorX, cursorY, {
        minX,
        minY,
        frameW,
        frameH,
        config,
        keyIndex: keys.indexOf(tile.key),
      });
      const unwrap = heatTransferUnwrapMetrics(tile);
      layout.push({
        row: rowIndex,
        column: columnIndex,
        label: tile.key.label,
        source: { x: tile.key.x, y: tile.key.y, w: tile.key.w, h: tile.key.h },
        sheetPx: { x: cursorX, y: cursorY, width: tileW, height: tileH },
        sheetMm: {
          x: cursorX / HEAT_TRANSFER_PX_PER_MM,
          y: cursorY / HEAT_TRANSFER_PX_PER_MM,
          width: tileW / HEAT_TRANSFER_PX_PER_MM,
          height: tileH / HEAT_TRANSFER_PX_PER_MM,
        },
        faces: {
          back: { x: tile.sideX, y: 0, width: tile.topW, height: tile.sideY },
          left: { x: 0, y: tile.sideY, width: tile.sideX, height: tile.topH },
          top: { x: tile.sideX, y: tile.sideY, width: tile.topW, height: tile.topH },
          right: { x: tile.sideX + tile.topW, y: tile.sideY, width: tile.sideX, height: tile.topH },
          front: { x: tile.sideX, y: tile.sideY + tile.topH, width: tile.topW, height: tile.sideY },
        },
        unwrap3x3: {
          cornerWidthPx: unwrap.cornerW,
          cornerHeightPx: unwrap.cornerH,
          centerPx: { x: tile.sideX, y: tile.sideY, width: tile.topW, height: tile.topH },
          sideDepthPx: { x: tile.sideX, y: tile.sideY },
          projectedInsetPx: { x: tile.projectedInsetX, y: tile.projectedInsetY },
        },
      });
      cursorX += tileW + spacingPx;
    }
    cursorY += rowSizes[rowIndex].height + spacingPx;
  }

  return { canvas, png: await canvasToPngBytes(canvas), layout };
}

async function createHeatTransferFaceCuts(config: SceneConfig, projectionCanvas: HTMLCanvasElement | null) {
  const keys = config.layoutKeys;
  if (!keys.length) return [];

  const frame = heatTransferFrameForKeys(keys);
  const cuts: Array<{
    path: string;
    data: Uint8Array;
    keyIndex: number;
    keyLabel: string;
    face: HeatTransferFaceName;
    sizePx: { width: number; height: number };
    sizeMm: { width: number; height: number };
  }> = [];

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const key = keys[keyIndex];
    const tile = heatTransferTileForKey(config, key);
    const keyLabel = resolveExportKeyLabel(key, config.keyOverrides[keyIndex]);
    const source = projectionCanvas ? heatTransferSourceForKey(tile, projectionCanvas, frame) : null;
    const faceNames: HeatTransferFaceName[] = ["top", "back", "front", "left", "right"];

    for (const face of faceNames) {
      const canvas = await createHeatTransferFaceCanvas(config, projectionCanvas, tile, keyIndex, face, source);
      const keySlug = safeFileBase(`${String(keyIndex + 1).padStart(3, "0")}-${keyLabel}`);
      const path = `production/key-faces/${keySlug}-${face}.png`;
      cuts.push({
        path,
        data: await canvasToPngBytes(canvas),
        keyIndex,
        keyLabel,
        face,
        sizePx: { width: canvas.width, height: canvas.height },
        sizeMm: {
          width: canvas.width / HEAT_TRANSFER_PX_PER_MM,
          height: canvas.height / HEAT_TRANSFER_PX_PER_MM,
        },
      });
    }
  }

  return cuts;
}

async function createHeatTransferFaceCanvas(
  config: SceneConfig,
  projectionCanvas: HTMLCanvasElement | null,
  tile: HeatTransferTile,
  keyIndex: number,
  face: HeatTransferFaceName,
  source: HeatTransferSourceRect | null,
) {
  const canvas = document.createElement("canvas");
  const faceSize = heatTransferFaceSize(tile, face);
  canvas.width = faceSize.width;
  canvas.height = faceSize.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  drawHeatTransferFaceBase(ctx, tile, config, keyIndex, face);
  if (projectionCanvas && source) {
    drawHeatTransferFaceArtwork(ctx, projectionCanvas, tile, face, source);
  }
  await drawHeatTransferFaceLegends(ctx, tile, config, keyIndex, face);
  return canvas;
}

function heatTransferFrameForKeys(keys: ParsedKey[]): HeatTransferFrame {
  const minX = Math.min(...keys.map((key) => key.x));
  const minY = Math.min(...keys.map((key) => key.y));
  const maxX = Math.max(...keys.map((key) => key.x + key.w));
  const maxY = Math.max(...keys.map((key) => key.y + key.h));
  return {
    minX,
    minY,
    frameW: Math.max(1, maxX - minX),
    frameH: Math.max(1, maxY - minY),
  };
}

function heatTransferSourceForKey(tile: HeatTransferTile, projectionCanvas: HTMLCanvasElement, frame: HeatTransferFrame): HeatTransferSourceRect {
  return {
    sourceX: ((tile.key.x - frame.minX) / frame.frameW) * projectionCanvas.width,
    sourceY: ((tile.key.y - frame.minY) / frame.frameH) * projectionCanvas.height,
    sourceW: (tile.key.w / frame.frameW) * projectionCanvas.width,
    sourceH: (tile.key.h / frame.frameH) * projectionCanvas.height,
  };
}

function heatTransferFaceSize(tile: HeatTransferTile, face: HeatTransferFaceName) {
  if (face === "left" || face === "right") return { width: tile.sideX, height: tile.topH };
  if (face === "back" || face === "front") return { width: tile.topW, height: tile.sideY };
  return { width: tile.topW, height: tile.topH };
}

function drawHeatTransferFaceBase(
  ctx: CanvasRenderingContext2D,
  tile: HeatTransferTile,
  config: SceneConfig,
  keyIndex: number,
  face: HeatTransferFaceName,
) {
  const override = config.keyOverrides[keyIndex] ?? {};
  const color = override.color ?? tile.key.color ?? config.keycapColor;
  ctx.fillStyle = face === "top" ? color : shadeColor(color, -12);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawHeatTransferFaceArtwork(
  ctx: CanvasRenderingContext2D,
  projectionCanvas: HTMLCanvasElement,
  tile: HeatTransferTile,
  face: HeatTransferFaceName,
  source: HeatTransferSourceRect,
) {
  const sourceBandX = Math.max(1, source.sourceW * (tile.projectedInsetX / tile.projectedBottomW));
  const sourceBandY = Math.max(1, source.sourceH * (tile.projectedInsetY / tile.projectedBottomH));
  const sourceCenterW = Math.max(1, source.sourceW - sourceBandX * 2);
  const sourceCenterH = Math.max(1, source.sourceH - sourceBandY * 2);
  const sx1 = source.sourceX + sourceBandX;
  const sx2 = source.sourceX + source.sourceW - sourceBandX;
  const sy1 = source.sourceY + sourceBandY;
  const sy2 = source.sourceY + source.sourceH - sourceBandY;

  if (face === "top") {
    drawClippedImage(ctx, projectionCanvas, sx1, sy1, sourceCenterW, sourceCenterH, 0, 0, tile.topW, tile.topH);
  } else if (face === "back") {
    drawClippedImage(ctx, projectionCanvas, sx1, source.sourceY, sourceCenterW, sourceBandY, 0, 0, tile.topW, tile.sideY);
  } else if (face === "front") {
    drawClippedImage(ctx, projectionCanvas, sx1, sy2, sourceCenterW, sourceBandY, 0, 0, tile.topW, tile.sideY);
  } else if (face === "left") {
    drawClippedImage(ctx, projectionCanvas, source.sourceX, sy1, sourceBandX, sourceCenterH, 0, 0, tile.sideX, tile.topH);
  } else {
    drawClippedImage(ctx, projectionCanvas, sx2, sy1, sourceBandX, sourceCenterH, 0, 0, tile.sideX, tile.topH);
  }
}

async function drawHeatTransferFaceLegends(
  ctx: CanvasRenderingContext2D,
  tile: HeatTransferTile,
  config: SceneConfig,
  keyIndex: number,
  face: HeatTransferFaceName,
) {
  const { entries, legendScale, legendFont } = heatTransferLegendContext(tile, config, keyIndex);
  if (face === "top") {
    drawLegendEntries(ctx, entries.filter((entry) => entry.index < 9), {
      x: 0,
      y: 0,
      width: tile.topW,
      height: tile.topH,
      fontScale: Math.min(tile.topW, tile.topH) / 512,
      legendScale,
      legendFont,
    });

    const iconUrl = config.keyOverrides[keyIndex]?.iconImageUrl;
    if (!iconUrl) return;
    const icon = await loadExportImage(iconUrl);
    if (!icon) return;
    const override = config.keyOverrides[keyIndex] ?? {};
    const [iconX, iconY] = EXPORT_LEGEND_POSITIONS[Math.max(0, Math.min(8, override.iconPosition ?? 4))] ?? EXPORT_LEGEND_POSITIONS[4];
    const iconSize = tile.topW * 0.42 * Math.max(0.2, Math.min(2.4, override.iconScale ?? 1));
    ctx.drawImage(icon, iconX * tile.topW - iconSize / 2, iconY * tile.topH - iconSize / 2, iconSize, iconSize);
    return;
  }

  if (face === "front") {
    drawLegendEntries(ctx, entries.filter((entry) => entry.index >= 9), {
      x: 0,
      y: 0,
      width: tile.topW,
      height: tile.sideY,
      fontScale: Math.min(tile.topW, tile.sideY) / 512,
      legendScale,
      legendFont,
    });
  }
}

function groupKeysForTransfer(keys: ParsedKey[]) {
  const rows: ParsedKey[][] = [];
  keys
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach((key) => {
      const row = rows.find((items) => Math.abs(items[0].y - key.y) < 0.01);
      if (row) row.push(key);
      else rows.push([key]);
    });
  rows.forEach((row) => row.sort((a, b) => a.x - b.x));
  return rows;
}

function heatTransferTileForKey(config: SceneConfig, key: ParsedKey): HeatTransferTile {
  const profile = profiles[config.profileId] ?? profiles.cherry;
  const row = key.profileRow === "SB" ? config.rowId : key.profileRow;
  const cfg = { ...profile.common, ...profile.rows[row], dishDepth: config.dishDepth };
  const bottomWmm = profile.common.bottomKeyWidth + (key.w - 1) * KEY_UNIT_MM;
  const bottomHmm = profile.common.bottomKeyHeight + (key.h - 1) * KEY_UNIT_MM;
  const topWmm = Math.max(6, bottomWmm - profile.common.widthDifference);
  const topHmm = Math.max(6, bottomHmm - profile.common.heightDifference);
  const insetXmm = Math.max(0.1, (bottomWmm - topWmm) / 2);
  const insetYmm = Math.max(0.1, (bottomHmm - topHmm) / 2);
  const sideXmm = Math.hypot(insetXmm, cfg.totalDepth);
  const sideYmm = Math.hypot(insetYmm, cfg.totalDepth);
  const px = HEAT_TRANSFER_PX_PER_MM;

  return {
    key,
    topW: Math.round(topWmm * px),
    topH: Math.round(topHmm * px),
    sideX: Math.round(sideXmm * px),
    sideY: Math.round(sideYmm * px),
    projectedBottomW: Math.max(1, bottomWmm * px),
    projectedBottomH: Math.max(1, bottomHmm * px),
    projectedInsetX: Math.max(1, insetXmm * px),
    projectedInsetY: Math.max(1, insetYmm * px),
  };
}

async function drawHeatTransferTile(
  ctx: CanvasRenderingContext2D,
  projectionCanvas: HTMLCanvasElement | null,
  tile: HeatTransferTile,
  x: number,
  y: number,
  frame: HeatTransferFrame & { config: SceneConfig; keyIndex: number },
) {
  drawHeatTransferKeyBase(ctx, tile, x, y, frame.config, frame.keyIndex);
  if (projectionCanvas) {
    const sourceX = ((tile.key.x - frame.minX) / frame.frameW) * projectionCanvas.width;
    const sourceY = ((tile.key.y - frame.minY) / frame.frameH) * projectionCanvas.height;
    const sourceW = (tile.key.w / frame.frameW) * projectionCanvas.width;
    const sourceH = (tile.key.h / frame.frameH) * projectionCanvas.height;
    drawHeatTransferUnwrap3x3(ctx, projectionCanvas, tile, x, y, { sourceX, sourceY, sourceW, sourceH });
  }
  await drawHeatTransferLegends(ctx, tile, x, y, frame.config, frame.keyIndex);
}

function drawHeatTransferUnwrap3x3(
  ctx: CanvasRenderingContext2D,
  projectionCanvas: HTMLCanvasElement,
  tile: HeatTransferTile,
  x: number,
  y: number,
  source: HeatTransferSourceRect,
) {
  const sourceBandX = Math.max(1, source.sourceW * (tile.projectedInsetX / tile.projectedBottomW));
  const sourceBandY = Math.max(1, source.sourceH * (tile.projectedInsetY / tile.projectedBottomH));
  const sourceCenterW = Math.max(1, source.sourceW - sourceBandX * 2);
  const sourceCenterH = Math.max(1, source.sourceH - sourceBandY * 2);
  const { cornerW, cornerH } = heatTransferUnwrapMetrics(tile);
  const overlap = Math.min(HEAT_TRANSFER_FACE_JOIN_OVERLAP_PX, tile.sideX / 3, tile.sideY / 3);

  const sx0 = source.sourceX;
  const sx1 = source.sourceX + sourceBandX;
  const sx2 = source.sourceX + source.sourceW - sourceBandX;
  const sy0 = source.sourceY;
  const sy1 = source.sourceY + sourceBandY;
  const sy2 = source.sourceY + source.sourceH - sourceBandY;
  const topX = x + tile.sideX;
  const topY = y + tile.sideY;

  drawClippedImage(ctx, projectionCanvas, sx1, sy1, sourceCenterW, sourceCenterH, topX - overlap, topY - overlap, tile.topW + overlap * 2, tile.topH + overlap * 2);

  drawClippedImage(ctx, projectionCanvas, sx1, sy0, sourceCenterW, sourceBandY, topX + cornerW, y, Math.max(1, tile.topW - cornerW * 2), tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx1, sy2, sourceCenterW, sourceBandY, topX + cornerW, topY + tile.topH - overlap, Math.max(1, tile.topW - cornerW * 2), tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx0, sy1, sourceBandX, sourceCenterH, x, topY + cornerH, tile.sideX + overlap, Math.max(1, tile.topH - cornerH * 2));
  drawClippedImage(ctx, projectionCanvas, sx2, sy1, sourceBandX, sourceCenterH, topX + tile.topW - overlap, topY + cornerH, tile.sideX + overlap, Math.max(1, tile.topH - cornerH * 2));

  drawClippedImage(ctx, projectionCanvas, sx0, sy0, sourceBandX, sourceBandY, x, topY, tile.sideX + overlap, cornerH + overlap);
  drawClippedImage(ctx, projectionCanvas, sx0, sy2, sourceBandX, sourceBandY, x, topY + tile.topH - cornerH, tile.sideX + overlap, cornerH + overlap);
  drawClippedImage(ctx, projectionCanvas, sx2, sy0, sourceBandX, sourceBandY, topX + tile.topW - overlap, topY, tile.sideX + overlap, cornerH + overlap);
  drawClippedImage(ctx, projectionCanvas, sx2, sy2, sourceBandX, sourceBandY, topX + tile.topW - overlap, topY + tile.topH - cornerH, tile.sideX + overlap, cornerH + overlap);

  drawClippedImage(ctx, projectionCanvas, sx0, sy0, sourceBandX, sourceBandY, topX, y, cornerW + overlap, tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx2, sy0, sourceBandX, sourceBandY, topX + tile.topW - cornerW, y, cornerW + overlap, tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx0, sy2, sourceBandX, sourceBandY, topX, topY + tile.topH - overlap, cornerW + overlap, tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx2, sy2, sourceBandX, sourceBandY, topX + tile.topW - cornerW, topY + tile.topH - overlap, cornerW + overlap, tile.sideY + overlap);
}

function heatTransferUnwrapMetrics(tile: HeatTransferTile) {
  return {
    cornerW: Math.min(tile.sideX, Math.max(1, tile.topW * (tile.projectedInsetX / tile.projectedBottomW))),
    cornerH: Math.min(tile.sideY, Math.max(1, tile.topH * (tile.projectedInsetY / tile.projectedBottomH))),
  };
}

function drawHeatTransferKeyBase(
  ctx: CanvasRenderingContext2D,
  tile: HeatTransferTile,
  x: number,
  y: number,
  config: SceneConfig,
  keyIndex: number,
) {
  const override = config.keyOverrides[keyIndex] ?? {};
  const color = override.color ?? tile.key.color ?? config.keycapColor;
  const overlap = Math.min(HEAT_TRANSFER_FACE_JOIN_OVERLAP_PX, tile.sideX / 3, tile.sideY / 3);
  ctx.fillStyle = shadeColor(color, -12);
  ctx.fillRect(x + tile.sideX, y, tile.topW, tile.sideY + overlap);
  ctx.fillRect(x, y + tile.sideY, tile.sideX + overlap, tile.topH);
  ctx.fillRect(x + tile.sideX + tile.topW - overlap, y + tile.sideY, tile.sideX + overlap, tile.topH);
  ctx.fillRect(x + tile.sideX, y + tile.sideY + tile.topH - overlap, tile.topW, tile.sideY + overlap);
  ctx.fillStyle = color;
  ctx.fillRect(x + tile.sideX - overlap, y + tile.sideY - overlap, tile.topW + overlap * 2, tile.topH + overlap * 2);
}

async function drawHeatTransferLegends(
  ctx: CanvasRenderingContext2D,
  tile: HeatTransferTile,
  x: number,
  y: number,
  config: SceneConfig,
  keyIndex: number,
) {
  const { entries, legendScale, legendFont } = heatTransferLegendContext(tile, config, keyIndex);

  drawLegendEntries(ctx, entries.filter((entry) => entry.index < 9), {
    x: x + tile.sideX,
    y: y + tile.sideY,
    width: tile.topW,
    height: tile.topH,
    fontScale: Math.min(tile.topW, tile.topH) / 512,
    legendScale,
    legendFont,
  });
  drawLegendEntries(ctx, entries.filter((entry) => entry.index >= 9), {
    x: x + tile.sideX,
    y: y + tile.sideY + tile.topH,
    width: tile.topW,
    height: tile.sideY,
    fontScale: Math.min(tile.topW, tile.sideY) / 512,
    legendScale,
    legendFont,
  });

  const override = config.keyOverrides[keyIndex] ?? {};
  const iconUrl = override.iconImageUrl;
  if (!iconUrl) return;
  const icon = await loadExportImage(iconUrl);
  if (!icon) return;
  const [iconX, iconY] = EXPORT_LEGEND_POSITIONS[Math.max(0, Math.min(8, override.iconPosition ?? 4))] ?? EXPORT_LEGEND_POSITIONS[4];
  const iconSize = tile.topW * 0.42 * Math.max(0.2, Math.min(2.4, override.iconScale ?? 1));
  ctx.drawImage(icon, x + tile.sideX + iconX * tile.topW - iconSize / 2, y + tile.sideY + iconY * tile.topH - iconSize / 2, iconSize, iconSize);
}

function heatTransferLegendContext(tile: HeatTransferTile, config: SceneConfig, keyIndex: number) {
  const override = config.keyOverrides[keyIndex] ?? {};
  const labels = override.labels?.length ? override.labels : tile.key.labels;
  const entries = labels
    .map((label, index) => ({
      index,
      label: normalizeExportLegend(label ?? ""),
      color: override.legendColor ?? config.legendColor ?? tile.key.textColors[index] ?? tile.key.textColor,
      size: tile.key.textSizes[index] ?? tile.key.textSize ?? 3,
    }))
    .filter((entry) => entry.label);
  const legendScale = override.legendScale ?? config.legendScale;
  const legendFont = override.legendFont ?? config.legendFont;
  return { entries, legendScale, legendFont };
}

const EXPORT_LEGEND_POSITIONS: Array<[number, number]> = [
  [0.18, 0.18],
  [0.5, 0.18],
  [0.82, 0.18],
  [0.18, 0.5],
  [0.5, 0.5],
  [0.82, 0.5],
  [0.18, 0.82],
  [0.5, 0.82],
  [0.82, 0.82],
  [0.18, 0.5],
  [0.5, 0.5],
  [0.82, 0.5],
];

function drawLegendEntries(
  ctx: CanvasRenderingContext2D,
  entries: Array<{ index: number; label: string; color: string; size: number }>,
  area: { x: number; y: number; width: number; height: number; fontScale: number; legendScale: number; legendFont: string },
) {
  ctx.save();
  ctx.textBaseline = "middle";
  entries.forEach((entry) => {
    const [positionX, positionY] = EXPORT_LEGEND_POSITIONS[entry.index] ?? EXPORT_LEGEND_POSITIONS[4];
    const fontSize = Math.max(7, Math.min(area.height * 0.68, (6 + entry.size * 2) * 1.95 * area.legendScale * area.fontScale));
    ctx.fillStyle = entry.color;
    ctx.font = `600 ${fontSize}px ${area.legendFont}, "Segoe UI Symbol", "Arial Unicode MS", sans-serif`;
    ctx.textAlign = positionX < 0.34 ? "left" : positionX > 0.66 ? "right" : "center";
    const lines = entry.label.split("\n").filter(Boolean).slice(0, 2);
    const lineHeight = fontSize * 1.08;
    lines.forEach((line, lineIndex) => {
      const offset = (lineIndex - (lines.length - 1) / 2) * lineHeight;
      ctx.fillText(line, area.x + positionX * area.width, area.y + positionY * area.height + offset);
    });
  });
  ctx.restore();
}

function normalizeExportLegend(raw: string) {
  const withoutTags = raw.replace(/<i[^>]*class=["'][^"']*(fa-[a-z0-9-]+)[^"']*["'][^>]*><\/i>/gi, (_match, icon: string) => icon.replace(/^fa-/, ""));
  const text = withoutTags.replace(/<[^>]+>/g, "").trim();
  if (!text) return "";
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

async function loadExportImage(url: string) {
  const image = new Image();
  image.src = url;
  try {
    await withTimeout(image.decode(), IMAGE_DECODE_TIMEOUT_MS, "Image decode timed out");
    return image;
  } catch {
    return null;
  }
}

function resolveExportKeyLabel(key: ParsedKey, override: SceneConfig["keyOverrides"][number] | undefined) {
  const labels = override?.labels ?? key.labels ?? [];
  return labels.find(Boolean) ?? key.label ?? "Key";
}

function shadeColor(color: string, amount: number) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const channel = (start: number) => Math.max(0, Math.min(255, parseInt(hex.slice(start, start + 2), 16) + amount));
  return `#${[channel(0), channel(2), channel(4)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function drawClippedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const bleedX = Math.min(HEAT_TRANSFER_BLEED_PX, Math.max(0, dw / 3));
  const bleedY = Math.min(HEAT_TRANSFER_BLEED_PX, Math.max(0, dh / 3));
  const sourceBleedX = (sw / dw) * bleedX;
  const sourceBleedY = (sh / dh) * bleedY;
  const expandedSx = sx - sourceBleedX;
  const expandedSy = sy - sourceBleedY;
  const expandedSw = sw + sourceBleedX * 2;
  const expandedSh = sh + sourceBleedY * 2;
  const expandedDx = dx - bleedX;
  const expandedDy = dy - bleedY;
  const expandedDw = dw + bleedX * 2;
  const expandedDh = dh + bleedY * 2;

  const clippedX = Math.max(0, expandedSx);
  const clippedY = Math.max(0, expandedSy);
  const clippedRight = Math.min(sourceWidth, expandedSx + expandedSw);
  const clippedBottom = Math.min(sourceHeight, expandedSy + expandedSh);
  const clippedW = clippedRight - clippedX;
  const clippedH = clippedBottom - clippedY;
  if (clippedW <= 0 || clippedH <= 0) return;

  const offsetX = ((clippedX - expandedSx) / expandedSw) * expandedDw;
  const offsetY = ((clippedY - expandedSy) / expandedSh) * expandedDh;
  const destW = (clippedW / expandedSw) * expandedDw;
  const destH = (clippedH / expandedSh) * expandedDh;
  ctx.drawImage(image, clippedX, clippedY, clippedW, clippedH, expandedDx + offsetX, expandedDy + offsetY, destW, destH);
}

async function canvasToPngBytes(canvas: HTMLCanvasElement) {
  if (canvas.width * canvas.height <= DATA_URL_CANVAS_PIXEL_LIMIT) {
    return canvasToDataUrlPngBytes(canvas);
  }

  try {
    const blob = await canvasToBlob(canvas, "image/png");
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return canvasToDataUrlPngBytes(canvas);
  }
}

async function layerImageBytes(layer: ProjectionLayer): Promise<{ data: Uint8Array; mime: string }> {
  if (layer.sourceDataUrl) {
    const parsed = dataUrlToBytes(layer.sourceDataUrl);
    if (parsed) return parsed;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, layer.image.naturalWidth || Math.round(layer.width));
  canvas.height = Math.max(1, layer.image.naturalHeight || Math.round(layer.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { data: new Uint8Array(), mime: "image/png" };
  ctx.drawImage(layer.image, 0, 0, canvas.width, canvas.height);
  return { data: await canvasToPngBytes(canvas), mime: "image/png" };
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime: string) {
  return withTimeout(
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) resolve(nextBlob);
        else reject(new Error(`Canvas toBlob returned null for ${canvas.width}x${canvas.height} canvas.`));
      }, mime);
    }),
    CANVAS_ENCODE_TIMEOUT_MS,
    `Canvas PNG encode timed out for ${canvas.width}x${canvas.height} canvas.`,
  );
}

function canvasToDataUrlPngBytes(canvas: HTMLCanvasElement) {
  const fallback = dataUrlToBytes(canvas.toDataURL("image/png"));
  if (!fallback || fallback.data.length === 0) {
    throw new Error(`PNG encode failed for ${canvas.width}x${canvas.height} canvas.`);
  }
  return fallback.data;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId = 0;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function dataUrlToBytes(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const data = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
  return { data, mime };
}

function extensionFromMime(mime: string, fallbackName: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  const extension = fallbackName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || "png";
}

function safeFileBase(name: string) {
  const base = name.replace(/\.[^/.]+$/, "");
  return base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "layer";
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

type ZipFile = {
  path: string;
  data: Uint8Array;
};

function createZip(files: ZipFile[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = new TextEncoder().encode(file.path.replace(/\\/g, "/"));
    const crc = crc32(file.data);
    const localHeader = new Uint8Array(30 + name.length);
    const local = new DataView(localHeader.buffer);
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime(), true);
    local.setUint16(12, dosDate(), true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + name.length);
    const central = new DataView(centralHeader.buffer);
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dosTime(), true);
    central.setUint16(14, dosDate(), true);
    central.setUint32(16, crc, true);
    central.setUint32(20, file.data.length, true);
    central.setUint32(24, file.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + file.data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const parts = [...localParts, ...centralParts, end];
  const zipBytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  parts.forEach((part) => {
    zipBytes.set(part, cursor);
    cursor += part.length;
  });
  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
  return new Blob([zipBuffer], { type: "application/zip" });
}

function dosTime(date = new Date()) {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function dosDate(date = new Date()) {
  return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
