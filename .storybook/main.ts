import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../packages/chessboard-react/stories/**/*.stories.tsx"],
};

export default config;
