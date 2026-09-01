import { nodeConfig } from "@chia/test/config";

export default nodeConfig({
  test: {
    setupFiles: ["./__tests__/setup.ts"],
  },
});
