import "zod/compile";
import * as z from "zod";

import {
  notifyReportStep,
  ReportTriageStatus,
  triageReportStep,
} from "../steps/report-triage.step";

export const reportTriageRequestSchema = z.object({
  reportId: z.number().int().positive(),
  /** `false` skips the operator email: a triage the operator started by hand. */
  notify: z.boolean().optional(),
});

/**
 * Started when the public agent files a report, or by the operator from the report page: triage
 * writes its reading to the row, then the operator is emailed with it unless `notify` is
 * `false`. A failed triage still sends the email, without the reading.
 */
export const reportTriageWorkflow = async (
  request: z.input<typeof reportTriageRequestSchema>
) => {
  "use workflow";

  const { reportId, notify } = reportTriageRequestSchema.parse(request);

  const triage = await triageReportStep(reportId);
  if (triage === ReportTriageStatus.ReportGone || notify === false) {
    return { reportId, triage };
  }
  const notified = await notifyReportStep(reportId);
  return { reportId, triage, notified };
};
