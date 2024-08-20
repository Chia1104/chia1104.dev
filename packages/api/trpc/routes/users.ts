import { updateUserProfile } from "@chia/db/utils/users";
import { insertUserSchema } from "@chia/db/validator/users";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const usersRouter = createTRPCRouter({
  updateUserProfile: protectedProcedure
    .input(insertUserSchema)
    .mutation((opts) => updateUserProfile(opts.ctx.db, opts.input)),
});
