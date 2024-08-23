import type { z } from "zod";

import { errorGenerator } from "@chia/utils";

export const errorResponse = (zodError: z.ZodError, status = 400) => {
  if (zodError.errors[0].code === "invalid_union") {
    return errorGenerator(
      status,
      zodError.errors[0].unionErrors.map((error) => ({
        field: error.issues[0].path.join("."),
        message: error.issues[0].message,
      }))
    );
  }

  return errorGenerator(
    status,
    zodError.issues?.map((issue) => {
      return {
        field: issue.path.join("."),
        message: issue.message,
      };
    })
  );
};
