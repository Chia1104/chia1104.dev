import { resolveAccess } from "@chia/auth/access";
import { resolveSession } from "@chia/service-kit/policies/session.policy";
import { getAdminId } from "@chia/utils/config";

import { contractOS } from "../shared/context";

export const sessionRoute = contractOS.auth.session.handler(async (opts) => {
  const session = await resolveSession(opts.context);
  if (!session) return null;
  return {
    user: session.user,
    expiresAt: session.session.expiresAt.toISOString(),
    access: await resolveAccess(opts.context.db, session.user, getAdminId(), {
      agentKinds: opts.context.config.agentKinds,
    }),
  };
});

export const authRouter = contractOS.auth.router({
  session: sessionRoute,
});
