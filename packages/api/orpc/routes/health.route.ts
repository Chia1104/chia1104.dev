import { authGuard } from "../guards/auth.guard";
import { contractOS } from "../utils";

export const protectedHealthRoute = contractOS.health.client
  .use(authGuard)
  .handler(() => {
    return { status: "ok" };
  });
