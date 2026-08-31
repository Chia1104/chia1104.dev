import "zod/compile";
import * as z from "zod";

import { isResourceType, resourceTypes } from "@chia/api/resources/registry";

import { indexResource } from "../steps/resource-index.step";
import type { ResourceIndexResult } from "../steps/resource-index.step";

export const resourceIndexRequestSchema = z.object({
  // rejected at the boundary rather than deep inside `getResourceAdapter`, so a
  // bad request never becomes a workflow run that retries its way to failure
  sourceType: z.string().refine(isResourceType, {
    message: `Must be one of: ${resourceTypes.join(", ")}`,
  }),
  sourceId: z.number().int().positive(),
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
