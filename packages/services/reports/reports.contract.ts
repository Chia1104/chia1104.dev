import { oc } from "@orpc/contract";
import * as z from "zod";

import {
  FeedReportCategory,
  FeedReportStatus,
  FeedReportVerdict,
} from "@chia/db/schema";
import { feedType, locale } from "@chia/db/schema/enums";
import {
  reportTriageOutputSchema,
  workflowRunStatusSchema,
} from "@chia/workflow-control/contract";

/**
 * Reader reports the public agent filed on published posts. Operator-only: every text field
 * is a reader's or a model's words, shown as quoted text and never followed.
 */

const reportIdSchema = z.object({ id: z.number().int().positive() });

export const feedReportStatusSchema = z.enum(Object.values(FeedReportStatus));

const feedReportEditSchema = z.object({
  locale: z.enum(locale.enumValues),
  find: z.string(),
  replace: z.string(),
});

const feedReportSchema = reportIdSchema.extend({
  feedId: z.number().int(),
  locale: z.enum(locale.enumValues),
  headingPath: z.string().nullable(),
  quote: z.string().nullable(),
  category: z.enum(Object.values(FeedReportCategory)),
  claim: z.string(),
  assessment: z.string(),
  /** The corrected wording the reader or the reading assistant proposed; a candidate, never applied as is. */
  suggestion: z.string().nullable(),
  status: feedReportStatusSchema,
  triage: z
    .object({
      verdict: z.enum(Object.values(FeedReportVerdict)),
      summary: z.string(),
      edits: z.array(feedReportEditSchema),
      droppedEdits: z.number().int(),
    })
    .nullable(),
  post: z.object({
    slug: z.string(),
    type: z.enum(feedType.enumValues),
    title: z.string().nullable(),
    /** The post on the public site, in the report's locale. */
    url: z.string(),
  }),
  reporter: z.object({ name: z.string(), email: z.string() }).nullable(),
  /** The post's working draft, when one is open. */
  draftId: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FeedReportView = z.infer<typeof feedReportSchema>;

const errors = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  BAD_REQUEST: {},
  CONFLICT: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

/** Newest first. Unpaginated past `limit`: reports are a queue worked down, not an archive. */
export const listReportsContract = oc
  .errors(errors)
  .input(
    z
      .object({
        /** Omit for every report. */
        status: feedReportStatusSchema.optional(),
        limit: z.number().int().min(1).max(200).optional().default(100),
      })
      .optional()
      .default({ limit: 100 })
  )
  .output(z.object({ items: z.array(feedReportSchema) }));

export const getReportContract = oc
  .errors(errors)
  .input(reportIdSchema)
  .output(z.object({ report: feedReportSchema }));

/** `in_progress` and `resolved` are also set by applying suggestions and the post's draft. */
export const setReportStatusContract = oc
  .errors(errors)
  .input(reportIdSchema.extend({ status: feedReportStatusSchema }))
  .output(z.object({ report: feedReportSchema }));

/**
 * Writes the triage's suggested edits into the post's draft, opening one from the post when
 * none is open, and marks the report in progress. Nothing is published: the draft is applied
 * from the editor. `BAD_REQUEST` when the report is resolved or dismissed, or when a
 * suggestion no longer matches the draft; nothing is written then.
 */
export const applyReportEditsContract = oc
  .errors(errors)
  .input(reportIdSchema)
  .output(z.object({ report: feedReportSchema, draftId: z.number().int() }));

/**
 * Runs the triage task again on a report, without the email: the operator is already looking
 * at it. The run is read back by id until it settles; the report carries the result.
 */
export const startReportTriageContract = oc
  .errors(errors)
  .input(reportIdSchema)
  .output(z.object({ runId: z.string() }));

export const getReportTriageRunContract = oc
  .errors(errors)
  .input(z.object({ runId: z.string().min(1) }))
  .output(
    z.object({
      status: workflowRunStatusSchema,
      /** Only once the run completed. */
      output: reportTriageOutputSchema.optional(),
    })
  );

export const reportsContract = {
  list: listReportsContract,
  get: getReportContract,
  "status:set": setReportStatusContract,
  "edits:apply": applyReportEditsContract,
  "triage:start": startReportTriageContract,
  "triage:run": getReportTriageRunContract,
};
