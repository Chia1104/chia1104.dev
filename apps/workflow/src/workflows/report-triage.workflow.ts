import "zod/compile";
import * as z from "zod";

import {
  notifyReportStep,
  ReportTriageStatus,
  triageReportStep,
} from "../steps/report-triage.step";

export const reportTriageRequestSchema = z.object({
  reportId: z.number().int().positive(),
});

/**
 * Started when the public agent files a report: triage writes its reading to the row, then the
 * operator is emailed with it. A failed triage still sends the email, without the reading.
 */
export const reportTriageWorkflow = async (
  request: z.input<typeof reportTriageRequestSchema>
) => {
  "use workflow";

  const { reportId } = reportTriageRequestSchema.parse(request);

  const triage = await triageReportStep(reportId);
  if (triage === ReportTriageStatus.ReportGone) {
    return { reportId, triage };
  }
  const notified = await notifyReportStep(reportId);
  return { reportId, triage, notified };
};
