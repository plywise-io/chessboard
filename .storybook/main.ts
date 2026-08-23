import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../packages/chessboard-react/stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs"],
  async viteFinal(config) {
    // GitHub Pages serves project sites from a subpath.
    config.base = "/chessboard/";
    return config;
  },
};

export default config;
