import { createWorld } from "@workflow/world-postgres";
import { definePlugin } from "nitro";
import { setWorld } from "workflow/runtime";

export default definePlugin(() => {
  setWorld(createWorld());
});
