import "zod/compile";
import { createHook, sleep } from "workflow";
import * as z from "zod";

import { revalidateSiteStep } from "../steps/site-revalidation.step";

/** The longest a write waits to reach www; every write inside one window shares one invalidation. */
const WINDOW = "5m";

export const siteRevalidationRequestSchema = z.object({
  tag: z.string().min(1),
});

/**
 * Started once per www cache tag after every write that changes what those pages render. The
 * hook token is the tag's window: the first run to claim it waits the window out and
 * invalidates once; a run that finds it claimed ends at once, its write already covered by the
 * pending invalidation.
 *
 * Runs in the workflow sandbox: no Node built-ins.
 */
export const siteRevalidationWorkflow = async (
  request: z.input<typeof siteRevalidationRequestSchema>
) => {
  "use workflow";

  const { tag } = siteRevalidationRequestSchema.parse(request);
  const claim = createHook({ token: `site:revalidate:${tag}` });
  const owner = await claim.getConflict();
  if (owner) {
    return { coalescedInto: owner.runId };
  }

  await sleep(WINDOW);
  // A write from here on may land after the pages re-render, so it has to open the next window.
  claim.dispose();
  await revalidateSiteStep(tag);
  return { coalescedInto: null };
};
