import {
  listFeedReports,
  setFeedReportStatus,
} from "@chia/db/repos/feed-reports";
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";
import { reportTriageOutputSchema } from "@chia/workflow-control/contract";

import { contractOS } from "../shared/context";
import { adminGuard } from "../shared/guards/admin.guard";

import {
  applyReportEditsService,
  requireFeedReport,
  toFeedReportView,
} from "./report.service";

/** Every route is `adminGuard()`, reads included: a report carries a reader's account. */

export const listReportsRoute = contractOS.reports.list
  .use(adminGuard())
  .handler(async (opts) => ({
    items: (await listFeedReports(opts.context.db, opts.input)).map(
      toFeedReportView
    ),
  }));

export const getReportRoute = contractOS.reports.get
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => ({
      report: toFeedReportView(
        await requireFeedReport(opts.context.db, opts.input.id)
      ),
    }))
  );

export const setReportStatusRoute = contractOS.reports["status:set"]
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      const { db } = opts.context;
      if (!(await setFeedReportStatus(db, opts.input.id, opts.input.status))) {
        throw opts.errors.NOT_FOUND();
      }
      return {
        report: toFeedReportView(await requireFeedReport(db, opts.input.id)),
      };
    })
  );

export const applyReportEditsRoute = contractOS.reports["edits:apply"]
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      const { record, draftId } = await applyReportEditsService(
        opts.context.db,
        { id: opts.input.id, adminId: opts.context.adminId }
      );
      return { report: toFeedReportView(record), draftId };
    })
  );

export const startReportTriageRoute = contractOS.reports["triage:start"]
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      const { db, workflow } = opts.context;
      await requireFeedReport(db, opts.input.id);
      const runId = await workflow.startReportTriage(opts.input.id, {
        notify: false,
      });
      return { runId };
    })
  );

export const getReportTriageRunRoute = contractOS.reports["triage:run"]
  .use(adminGuard())
  .handler(async (opts) => {
    const run = await opts.context.workflow.getRun(opts.input.runId);
    if (!run.exists || !run.status) {
      throw opts.errors.NOT_FOUND();
    }
    // A run of another workflow, or one that threw, has no output of this shape.
    const output = reportTriageOutputSchema.safeParse(run.output);
    return {
      status: run.status,
      output: output.success ? output.data : undefined,
    };
  });

export const reportsRouter = contractOS.reports.router({
  list: listReportsRoute,
  get: getReportRoute,
  "status:set": setReportStatusRoute,
  "edits:apply": applyReportEditsRoute,
  "triage:start": startReportTriageRoute,
  "triage:run": getReportTriageRunRoute,
});
