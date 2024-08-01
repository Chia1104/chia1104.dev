import react from "@vitejs/plugin-react-swc";
import { defineProject } from "vitest/config";

export default defineProject({
  // @ts-ignore
  plugins: [react()],
  test: {
    environment: "happy-dom",
  },
});
