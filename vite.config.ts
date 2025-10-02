import tailwindcss from "@tailwindcss/vite";
import { build } from "esbuild";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "path";
import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Generic plugin to compile scripts with esbuild
function esbuildPlugin(options: {
  name: string;
  input: string;
  output: string;
  format: "esm" | "iife" | "cjs";
  target?: string;
  minify?: boolean;
}): Plugin {
  return {
    name: `esbuild-${options.name}`,
    writeBundle: async () => {
      try {
        await build({
          entryPoints: [resolve(__dirname, options.input)],
          bundle: true,
          outfile: resolve(__dirname, options.output),
          format: options.format,
          target: options.target || "es2020",
          minify: options.minify || false,
          sourcemap: true,
          external: [],
          define: {
            "process.env.NODE_ENV": JSON.stringify(
              process.env.NODE_ENV || "production",
            ),
          },
        });
        console.log(`✅ ${options.name} script compiled with esbuild`);
      } catch (error) {
        console.error(`❌ Failed to compile ${options.name} script:`, error);
      }
    },
  };
}

/** Fix For FireFox Fuckery */
function FFFFF(): Plugin {
  return {
    name: "firefox-manifest-fix",
    closeBundle: async () => {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");

        const manifestPath = path.resolve(__dirname, "dist/manifest.json");
        const manifestContent = await fs.readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestContent);

        // Convert service_worker to scripts array
        if (manifest.background?.service_worker) {
          manifest.background = {
            scripts: [manifest.background.service_worker],
          };
        }

        // Write the modified manifest
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        console.log("✅ Firefox manifest compatibility applied");
      } catch (error) {
        console.error("❌ Failed to apply Firefox manifest fix:", error);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    esbuildPlugin({
      name: "background",
      input: "src/background/index.ts",
      output: "dist/background.js",
      format: "iife",
    }),
    esbuildPlugin({
      name: "content",
      input: "src/content/index.ts",
      output: "dist/content.js",
      format: "iife",
    }),
    esbuildPlugin({
      name: "inject",
      input: "src/inject/index.ts",
      output: "dist/inject.js",
      format: "iife",
    }),
    process.env.FFFFF === "true" && FFFFF(),
  ],
  publicDir: "public",
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    minify: false,
    sourcemap: true,
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "production",
    ),
  },
});
