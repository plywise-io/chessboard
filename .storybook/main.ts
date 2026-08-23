import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../packages/chessboard-react/stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs"]
};

export default config;
