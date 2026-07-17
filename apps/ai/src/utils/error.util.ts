import type { z } from "zod";

import { errorGenerator } from "@chia/utils/server";

export const errorResponse = (
  zodError: z.core.$ZodError<unknown>,
  status = 400
) => {
  /**
   * TODO: Handle invalid union
   */
  // if (zodError.errors[0].code === "invalid_union") {
  //   return errorGenerator(
  //     status,
  //     zodError.errors[0].unionErrors.map((error) => ({
  //       field: error.issues[0].path.join("."),
  //       message: error.issues[0].message,
  //     }))
  //   );
  // }

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
