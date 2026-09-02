import { oc } from "@orpc/contract";
import * as z from "zod";

import { runSnapshotSchema } from "./rag.contract";

/** What the dashboard home shows: headline counts, not lists. */
export const dashboardOverviewSchema = z.object({
  users: z.object({
    /** Every row, guests included. */
    total: z.number().int(),
    guests: z.number().int(),
    /** Created in the last seven days. */
    newThisWeek: z.number().int(),
    banned: z.number().int(),
  }),
  content: z.object({
    posts: z.number().int(),
    notes: z.number().int(),
    drafts: z.number().int(),
  }),
  /** Newest index run of any scope; `null` before the first. */
  latestIndexRun: runSnapshotSchema.nullable(),
});

export const getDashboardOverviewContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, INTERNAL_SERVER_ERROR: {} })
  .output(dashboardOverviewSchema);

export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
