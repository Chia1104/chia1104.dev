import { updateUserProfile } from "@chia/db/repos/users";
import { insertUserSchema } from "@chia/db/validator/users";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const usersRouter = createTRPCRouter({
  updateUserProfile: protectedProcedure
    .input(insertUserSchema)
    .mutation(async (opts) => {
      await updateUserProfile(opts.ctx.db, opts.input);
    }),
});
