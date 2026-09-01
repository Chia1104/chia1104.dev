import { nodeConfig } from "@chia/test/config";

export default nodeConfig({
  test: {
    include: [
      "src/**/*.{test,spec}.{ts,tsx,mts}",
      "__tests__/**/*.{test,spec}.{ts,tsx,mts}",
      "spotify/**/*.{test,spec}.{ts,tsx}",
    ],
  },
});
