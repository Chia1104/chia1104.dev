import { contentReadTools } from "@chia/agent-content/tools/read";

import type { PublicTool } from "../types.ts";

export const createPublicTools = (): PublicTool[] => [...contentReadTools];
