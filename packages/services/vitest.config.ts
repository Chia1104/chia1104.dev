import { nodeConfig } from "@chia/test/config";

export default nodeConfig({
  test: {
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx,mts}"],
  },
});
