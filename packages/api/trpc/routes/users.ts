import { updateCacheUser } from "@chia/auth-core/adapter";
import { updateUserProfile } from "@chia/db/repos/users";
import { insertUserSchema } from "@chia/db/validator/users";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const usersRouter = createTRPCRouter({
  updateUserProfile: protectedProcedure
    .input(insertUserSchema)
    .mutation(async (opts) => {
      await updateUserProfile(opts.ctx.db, opts.input);
      await updateCacheUser({
        redis: opts.ctx.redis,
        userId: opts.ctx.session.user.id ?? opts.input.id,
      });
    }),
});
