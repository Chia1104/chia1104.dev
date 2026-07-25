import { oc } from "@orpc/contract";
import * as z from "zod";

import { insertUserSchema, infiniteSchema } from "@chia/db/validator/users";

import { withMetaSchema } from "./shared";

const userSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.string(),
  banned: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updateUserProfileContract = oc
  // Without an explicit route the REST path would percent-encode the `:` in the router
  // key (`/user/profile%3Aupdate`).
  .route({ method: "PATCH", path: "/users/profile" })
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

export const getInfiniteUsersContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(infiniteSchema)
  .output(withMetaSchema(userSchema));
