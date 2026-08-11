import * as z from "zod";

import { indexResource } from "../steps/resource-index.step";
import type { ResourceIndexResult } from "../steps/resource-index.step";

export const resourceIndexRequestSchema = z.object({
  sourceType: z.string(),
  sourceId: z.number(),
});

export type { ResourceIndexResult };

/**
 * Indexes one resource, whatever its type. Resource-specific behaviour lives in
 * the registered adapter.
 */
export const indexResourceWorkflow = async (
  request: z.input<typeof resourceIndexRequestSchema>
): Promise<ResourceIndexResult> => {
  "use workflow";

  return await indexResource(resourceIndexRequestSchema.parse(request));
};
