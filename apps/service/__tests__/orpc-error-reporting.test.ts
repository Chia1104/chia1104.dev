import { ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";

import { withErrorReporting } from "../src/factories/orpc.factory";

const run = async (error: unknown) => {
  const onError = vi.fn();
  const thrown = await withErrorReporting(
    { requestId: "req-1", hooks: { onError } },
    () => Promise.reject(error)
  ).catch((cause: unknown) => cause);
  return { onError, thrown };
};

describe("withErrorReporting", () => {
  it("passes a caller failure through unreported", async () => {
    const refusal = new ORPCError("QUOTA_EXCEEDED", { data: { a: 1 } });
    const { onError, thrown } = await run(refusal);

    expect(onError).not.toHaveBeenCalled();
    expect(thrown).toBe(refusal);
  });

  it("reports an unexpected error once and hides it behind a reference", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("db exploded");
    const { onError, thrown } = await run(cause);

    expect(onError).toHaveBeenCalledExactlyOnceWith(cause);
    expect(thrown).toBeInstanceOf(ORPCError);
    expect(thrown).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      data: { requestId: "req-1" },
    });
    expect((thrown as Error).message).not.toContain("db exploded");
  });

  it("keeps a service-side ORPCError's code and data beside the reference", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { onError, thrown } = await run(
      new ORPCError("SERVICE_UNAVAILABLE", { data: { retryAfter: 30 } })
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(thrown).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      data: { retryAfter: 30, requestId: "req-1" },
    });
  });
});
