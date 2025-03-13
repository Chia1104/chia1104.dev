import { TRPCError } from "@trpc/server";

import { APIError } from "@chia/auth/types";

export const authError = (error: unknown): never => {
  if (error instanceof APIError) {
    switch (error.statusCode) {
      case 401:
        throw new TRPCError({ code: "UNAUTHORIZED" });
      case 403:
        throw new TRPCError({ code: "FORBIDDEN" });
      case 404:
        throw new TRPCError({ code: "NOT_FOUND" });
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
};
