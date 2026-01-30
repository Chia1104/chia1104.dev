import { updateUserProfile } from "@chia/db/repos/users";
import { tryCatch } from "@chia/utils/error-helper";

import { authGuard } from "../guards/auth.guard";
import { contractOS } from "../utils";

export const updateUserProfileRoute = contractOS.user["profile:update"]
  .use(authGuard)
  .handler(async (opts) => {
    const { data, error } = await tryCatch(
      updateUserProfile(opts.context.db, opts.input)
    );

    if (error) {
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    if (!data) {
      throw opts.errors.NOT_FOUND();
    }

    return data;
  });
