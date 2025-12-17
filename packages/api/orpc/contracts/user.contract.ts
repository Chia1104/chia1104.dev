import { oc } from "@orpc/contract";
import * as z from "zod";

import { insertUserSchema } from "@chia/db/validator/users";

export const updateUserProfileContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(insertUserSchema)
  .output(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      image: z.string().nullable(),
    })
  );
