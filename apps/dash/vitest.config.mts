import path from "node:path";

import react from "@vitejs/plugin-react-swc";

import { domConfig } from "@chia/test/config";

export default domConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
