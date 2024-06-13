import { defineConfig } from "tsup";

export default [
  defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "es2022",
    platform: "neutral",
    dts: true,
    external: ["preact/compat", "turbo-stream"],
  }),
  defineConfig({
    entry: ["src/vite.ts"],
    format: ["esm"],
    target: "es2022",
    platform: "node",
    dts: true,
    external: ["unplugin-rsc", "vite"],
  }),
  defineConfig({
    entry: ["src/runtime.client.ts"],
    format: ["esm"],
    target: "es2022",
    platform: "neutral",
    dts: false,
  }),
  defineConfig({
    entry: ["src/runtime.server.ts"],
    format: ["esm"],
    target: "es2022",
    platform: "neutral",
    dts: false,
  }),
];
