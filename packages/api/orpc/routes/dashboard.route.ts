import { getFeedStats } from "@chia/db/repos/feeds";
import { listResourceIndexRuns } from "@chia/db/repos/resources/index-run";
import { getUserStats } from "@chia/db/repos/users";
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";
import dayjs from "@chia/utils/day";

import {
  reconcileIndexRun,
  snapshotOfIndexRun,
} from "../../resources/index-run";
import { adminGuard } from "../guards/admin.guard";
import { callerGuard } from "../guards/caller.guard";
import { contractOS } from "../utils";

/** Guests are refused here so the dashboard never has to reason about them. */
export const getDashboardAccessRoute = contractOS.dashboard.access
  .use(callerGuard({ minTier: CallerTier.Session }))
  .handler(({ context }) => ({
    level:
      context.caller.tier >= CallerTier.Root
        ? ("operator" as const)
        : ("member" as const),
  }));

export const getDashboardOverviewRoute = contractOS.dashboard.overview
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      const { db, workflow } = opts.context;
      const [users, content, runs] = await Promise.all([
        getUserStats(db, { since: dayjs().subtract(7, "day").toDate() }),
        getFeedStats(db),
        listResourceIndexRuns(db, { limit: 1 }),
      ]);
      const latest = runs.items[0];
      return {
        users: {
          total: users.total,
          guests: users.guests,
          newThisWeek: users.newSince,
          banned: users.banned,
        },
        content,
        latestIndexRun: latest
          ? snapshotOfIndexRun(await reconcileIndexRun(db, workflow, latest))
          : null,
      };
    })
  );
