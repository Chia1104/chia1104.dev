import { contentReadTools } from "@chia/agent-content/tools/read";

import type { PublicTool } from "../types.ts";

/** The public agent's whole tool set: find, read, browse, classify — reads only. */
export const createPublicTools = (): PublicTool[] => [...contentReadTools];
