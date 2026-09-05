import { definePlugin } from "nitro";

import { startFeedDraftListener } from "../src/services/feed-draft-bus.service";

export default definePlugin((nitroApp) => {
  const controller = new AbortController();
  startFeedDraftListener(controller.signal);
  nitroApp.hooks.hook("close", () => controller.abort());
});
