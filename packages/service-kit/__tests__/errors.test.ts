import { describe, expect, it } from "vitest";
import * as z from "zod";

import {
  AppError,
  fromZodError,
  isAppError,
  toErrorResponse,
} from "../src/errors";

describe("AppError", () => {
  it("derives the HTTP status from the code", () => {
    expect(new AppError("UNAUTHORIZED").status).toBe(401);
    expect(new AppError("QUOTA_EXCEEDED").status).toBe(402);
    expect(new AppError("TOO_MANY_REQUESTS").status).toBe(429);
    expect(new AppError("SERVICE_UNAVAILABLE").status).toBe(503);
  });

  it("is detectable across module boundaries", () => {
    expect(isAppError(new AppError("NOT_FOUND"))).toBe(true);
    expect(isAppError(new Error("nope"))).toBe(false);
  });

  it("renders the errorGenerator body shape the frontends parse", () => {
    const error = new AppError("BAD_REQUEST", {
      issues: [{ field: "captcha", message: "CAPTCHA_FAILED" }],
    });

    expect(toErrorResponse(error)).toEqual({
      code: "Bad Request",
      status: 400,
      errors: [{ field: "captcha", message: "CAPTCHA_FAILED" }],
    });
  });
});

describe("fromZodError", () => {
  it("flattens issue paths into dotted field names", () => {
    const result = z
      .object({ model: z.object({ provider: z.string() }) })
      .safeParse({ model: {} });

    expect(result.success).toBe(false);
    if (result.success) return;

    const error = fromZodError(result.error);

    expect(error.status).toBe(400);
    expect(error.issues?.[0]?.field).toBe("model.provider");
  });
});
