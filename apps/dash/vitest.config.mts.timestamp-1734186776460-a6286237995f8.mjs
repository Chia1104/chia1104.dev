// apps/dash/vitest.config.mts
import react from "file:///Users/chia1104/Documents/GitHub/chia1104.dev/node_modules/.pnpm/@vitejs+plugin-react-swc@3.7.2_@swc+helpers@0.5.15_vite@5.4.11_@types+node@22.10.2_terser@5.37.0_/node_modules/@vitejs/plugin-react-swc/index.mjs";
import { defineConfig } from "file:///Users/chia1104/Documents/GitHub/chia1104.dev/node_modules/.pnpm/vitest@2.1.8_@types+node@22.10.2_happy-dom@15.11.7_jsdom@25.0.1_bufferutil@4.0.8__msw@2.6.8_@_3bgkbqdudrozjlqkuvoz6wlavi/node_modules/vitest/dist/config.js";
import path from "path";

var __vite_injected_original_dirname =
  "/Users/chia1104/Documents/GitHub/chia1104.dev/apps/dash";
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
    },
  },
});
export { vitest_config_default as default };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBwcy9kYXNoL3ZpdGVzdC5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2NoaWExMTA0L0RvY3VtZW50cy9HaXRIdWIvY2hpYTExMDQuZGV2L2FwcHMvZGFzaFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2NoaWExMTA0L0RvY3VtZW50cy9HaXRIdWIvY2hpYTExMDQuZGV2L2FwcHMvZGFzaC92aXRlc3QuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvY2hpYTExMDQvRG9jdW1lbnRzL0dpdEh1Yi9jaGlhMTEwNC5kZXYvYXBwcy9kYXNoL3ZpdGVzdC5jb25maWcubXRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVzdC9jb25maWdcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICAvLyBAdHMtaWdub3JlXG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgZW52aXJvbm1lbnQ6IFwiaGFwcHktZG9tXCIsXG4gICAgcGFzc1dpdGhOb1Rlc3RzOiB0cnVlLFxuICAgIHNldHVwRmlsZXM6IFtcIi4uLy4uL3Rvb2xpbmdzL3ZpdGVzdC9zZXR1cC50c1wiXSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZWLFNBQVMsb0JBQW9CO0FBQzFYLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyx3QkFBUSxhQUFhO0FBQUE7QUFBQSxFQUUxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsaUJBQWlCO0FBQUEsSUFDakIsWUFBWSxDQUFDLGdDQUFnQztBQUFBLEVBQy9DO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
