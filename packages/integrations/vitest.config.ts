import { nodeConfig } from "@chia/test/config";

export default nodeConfig({
  test: {
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
});
