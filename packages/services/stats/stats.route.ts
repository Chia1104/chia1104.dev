import { contractOS } from "../shared/context";
import { callerGuard } from "../shared/guards/caller.guard";
import { rateLimitGuard } from "../shared/guards/rate-limit.guard";

import { recordPageView } from "./view.service";

export const viewRoute = contractOS.stats.view
  .use(callerGuard())
  .use(rateLimitGuard("stats"))
  .handler(async ({ context, input }) => {
    await recordPageView(context, input);
  });

export const statsRouter = contractOS.stats.router({
  view: viewRoute,
});
