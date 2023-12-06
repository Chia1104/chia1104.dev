import { defineProject } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineProject({
  plugins: [react()],
  test: {
    environment: "happy-dom",
  },
});
