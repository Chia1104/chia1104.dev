import { defineConfig } from "cypress";

/** @type {import("cypress").CypressConfiguration} */
export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    defaultCommandTimeout: 10000,
  },
});
