import { definePlugin } from "nitro";

export default definePlugin(async () => {
  if (process.env.WORKFLOW_TARGET_WORLD === "@workflow/world-postgres") {
    console.log("Starting Postgres World...");
    const { createWorld } = await import("@workflow/world-postgres");
    await createWorld().start?.();
    console.log("Postgres World started");
  }
});
