import { definePlugin } from "nitro";

export default definePlugin(async () => {
  if (process.env.WORKFLOW_TARGET_WORLD === "@workflow/world-postgres") {
    console.log("Starting Postgres World...");
    const [{ createWorld }, { setWorld }] = await Promise.all([
      import("@workflow/world-postgres"),
      import("workflow/runtime"),
    ]);
    const world = createWorld();
    // The runtime otherwise builds its own world and starts that queue inside the first
    // request, so a second runner polls forever in that request's trace context.
    setWorld(world);
    await world.start?.();
    console.log("Postgres World started");
  }
});
