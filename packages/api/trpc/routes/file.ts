import { TRPCError } from "@trpc/server";

import { adminProcedureWithACL, createTRPCRouter } from "../trpc";

export const fileRouter = createTRPCRouter({
  uploadFile: adminProcedureWithACL({
    file: ["upload", "file.upload"],
  }).mutation(() => {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Not implemented",
    });
  }),
});
