// vitest.config.mts
import react from "file:///Users/chia1104/Documents/GitHub/chia1104.dev/node_modules/.pnpm/@vitejs+plugin-react-swc@3.7.0_@swc+helpers@0.5.12_vite@5.4.1_@types+node@22.4.0_terser@5.31.6_/node_modules/@vitejs/plugin-react-swc/index.mjs";
import { defineConfig } from "file:///Users/chia1104/Documents/GitHub/chia1104.dev/node_modules/.pnpm/vitest@2.0.5_@types+node@22.4.0_happy-dom@15.7.3_jsdom@25.0.0_bufferutil@4.0.8__terser@5.31.6/node_modules/vitest/dist/config.js";
import path from "path";

var __vite_injected_original_dirname =
  "/Users/chia1104/Documents/GitHub/chia1104.dev/apps/www";
var vitest_config_default = defineConfig({
  // @ts-ignore
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    passWithNoTests: true,
    setupFiles: ["../../toolings/vitest/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      test: path.resolve(__vite_injected_original_dirname, "./__tests__"),
    },
  },
});
export { vitest_config_default as default };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy5tdHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvY2hpYTExMDQvRG9jdW1lbnRzL0dpdEh1Yi9jaGlhMTEwNC5kZXYvYXBwcy93d3dcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9jaGlhMTEwNC9Eb2N1bWVudHMvR2l0SHViL2NoaWExMTA0LmRldi9hcHBzL3d3dy92aXRlc3QuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvY2hpYTExMDQvRG9jdW1lbnRzL0dpdEh1Yi9jaGlhMTEwNC5kZXYvYXBwcy93d3cvdml0ZXN0LmNvbmZpZy5tdHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZXN0L2NvbmZpZ1wiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIC8vIEB0cy1pZ25vcmVcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICB0ZXN0OiB7XG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBlbnZpcm9ubWVudDogXCJoYXBweS1kb21cIixcbiAgICBwYXNzV2l0aE5vVGVzdHM6IHRydWUsXG4gICAgc2V0dXBGaWxlczogW1wiLi4vLi4vdG9vbGluZ3Mvdml0ZXN0L3NldHVwLnRzXCJdLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgICAgXCJ0ZXN0XCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9fX3Rlc3RzX19cIiksXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwVixTQUFTLG9CQUFvQjtBQUN2WCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sd0JBQVEsYUFBYTtBQUFBO0FBQUEsRUFFMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLE1BQU07QUFBQSxJQUNKLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLGlCQUFpQjtBQUFBLElBQ2pCLFlBQVksQ0FBQyxnQ0FBZ0M7QUFBQSxFQUMvQztBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQ3BDLFFBQVEsS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxJQUMvQztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
