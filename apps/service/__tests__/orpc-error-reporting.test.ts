const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@chia/observability/report", () => ({ reportError }));

import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { withErrorReporting } from "../src/factories/orpc.factory";

const run = (error: unknown) =>
  withErrorReporting({ requestId: "req-1" }, () => Promise.reject(error)).catch(
    (cause: unknown) => cause
  );

describe("withErrorReporting", () => {
  beforeEach(() => {
    reportError.mockClear();
  });

  it("passes a caller failure through unreported", async () => {
    const refusal = new ORPCError("QUOTA_EXCEEDED", { data: { a: 1 } });
    const thrown = await run(refusal);

    expect(reportError).not.toHaveBeenCalled();
    expect(thrown).toBe(refusal);
  });

  it("reports an unexpected error once and hides it behind a reference", async () => {
    const cause = new Error("db exploded");
    const thrown = await run(cause);

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      cause,
      "Procedure failed",
      { requestId: "req-1" }
    );
    expect(thrown).toBeInstanceOf(ORPCError);
    expect(thrown).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      data: { requestId: "req-1" },
    });
    expect((thrown as Error).message).not.toContain("db exploded");
  });

  it("keeps a service-side ORPCError's code and data beside the reference", async () => {
    const thrown = await run(
      new ORPCError("SERVICE_UNAVAILABLE", { data: { retryAfter: 30 } })
    );

    expect(reportError).toHaveBeenCalledOnce();
    expect(thrown).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      data: { retryAfter: 30, requestId: "req-1" },
    });
  });
});
