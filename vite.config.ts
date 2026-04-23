import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { geminiAdVideoPlugin } from "./server/geminiAdVideo";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env.GEMINI_API_KEY ||= env.GEMINI_API_KEY;

  return {
    plugins: [react(), geminiAdVideoPlugin()],
    build: {
      rollupOptions: {
        input: {
          main: "index.html",
          configEditor: "config-editor.html",
        },
      },
    },
    resolve: {
      alias: {
        "@stores": "/src/stores",
        "@utils": "/src/utils",
      },
    },
  };
});
