import { getFeedStats } from "@chia/db/repos/feeds";
import { listResourceIndexRuns } from "@chia/db/repos/resources/index-run";
import { getUserStats } from "@chia/db/repos/users";
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";
import dayjs from "@chia/utils/day";

import {
  reconcileIndexRun,
  snapshotOfIndexRun,
} from "../../resources/index-run";
import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

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
