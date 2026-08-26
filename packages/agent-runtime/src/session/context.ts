import { buildSessionContext } from "@earendil-works/pi-agent-core";
import type { SessionContext } from "@earendil-works/pi-agent-core";

import type { SessionEntry } from "./entries.ts";
import { contextEntries } from "./entries.ts";

/**
 * Projects a branch into what the model sees: compaction summaries with their retained tail,
 * branch summaries, and the messages after them, plus the settings the branch recorded.
 *
 * The projection is Pi's own so the transcript reads exactly as it did under Pi's harness. It
 * must stay deterministic: a turn's provider request is the previous projection plus the entries
 * it appended, and any drift between the two breaks the provider's cached prefix.
 */
export const buildBranchContext = (
  entries: readonly SessionEntry[]
): SessionContext => buildSessionContext(contextEntries(entries));
