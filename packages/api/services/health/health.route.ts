import { contractOS } from "../shared/context";
import { authGuard } from "../shared/guards/auth.guard";

export const protectedHealthRoute = contractOS.health.client
  .use(authGuard)
  .handler(() => {
    return { status: "ok" };
  });

export const healthRouter = contractOS.health.router({
  client: protectedHealthRoute,
});
