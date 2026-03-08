import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Marginalia",
    identifier: "com.marginalia.app",
    version: "1.0.5",
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      "main-bridge": {
        entrypoint: "src/bridge/main-bridge.ts",
      },
      "quick-capture-bridge": {
        entrypoint: "src/bridge/quick-capture-bridge.ts",
      },
    },
    copy: {
      "resources/trayIconTemplate.png": "views/assets/trayIconTemplate.png",
      "resources/trayIconTemplate@2x.png": "views/assets/trayIconTemplate@2x.png",
    },
  },
  scripts: {
    postBuild: "scripts/copy-nextjs-output.ts",
  },
} satisfies ElectrobunConfig;
