import { oc } from "@orpc/contract";
import * as z from "zod";

export const healthContract = oc.output(
  z.object({
    status: z.string(),
  })
);

export const protectedHealthContract = oc
  .errors({
    UNAUTHORIZED: {},
  })
  .output(
    z.object({
      status: z.string(),
    })
  );
