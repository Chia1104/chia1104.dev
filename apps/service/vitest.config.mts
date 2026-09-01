import path from "node:path";

import { nodeConfig } from "@chia/test/config";

export default nodeConfig({
  test: {
    setupFiles: ["./__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      test: path.resolve(__dirname, "./__tests__"),
    },
  },
});
