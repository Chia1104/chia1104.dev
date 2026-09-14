import { fileURLToPath } from "node:url";

import type { NitroConfig } from "nitro/types";

/** Alias the telemetry entry imports to reach the preset's own server entry. */
export const PRESET_ENTRY_ALIAS = "#observability/preset-entry";

/**
 * Makes `entry` the production bundle's entry. It must call `startTelemetry()` and then
 * `await import("#observability/preset-entry")`: externals linked before the loader hook
 * (`pg`, `@redis/client`) are never instrumented. `nitro dev` keeps the preset entry.
 */
export const telemetryEntry = (entry: URL): NitroConfig["hooks"] => ({
  "build:before"(nitro) {
    if (nitro.options.dev) return;
    nitro.options.alias[PRESET_ENTRY_ALIAS] = nitro.options.entry;
    nitro.options.entry = fileURLToPath(entry);
  },
});
