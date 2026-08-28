import { definePlugin } from "nitro";

import { env } from "../src/env";

export default definePlugin(async (nitro) => {
  const { getWorld } = await import("workflow/runtime");
  const world = getWorld();

  console.log("Starting workflow world", {
    target: env.WORKFLOW_TARGET_WORLD ?? "local",
  });
  await world.start?.();

  nitro.hooks.hook("close", async () => {
    await world.close?.();
  });
});
