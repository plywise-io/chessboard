import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../packages/chessboard-react/stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs"],
  async viteFinal(config) {
    // GitHub Pages serves project sites from a subpath.
    config.base = "/chessboard/";
    // The ChessJsIntegration recipe imports types from `chess.js` only; the
    // dependency itself is consumer-supplied. Keep it external so the Storybook
    // build does not try to bundle it, and so consumers can install (or skip)
    // chess.js on their own without this story crashing.
    config.optimizeDeps = config.optimizeDeps ?? {};
    config.optimizeDeps.exclude = [
      ...(config.optimizeDeps.exclude ?? []),
      "chess.js",
    ];
    config.build = config.build ?? {};
    config.build.rollupOptions = config.build.rollupOptions ?? {};
    config.build.rollupOptions.external = [
      ...(config.build.rollupOptions.external ?? []),
      "chess.js",
    ];
    return config;
  },
};

export default config;
