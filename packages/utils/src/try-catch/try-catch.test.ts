import { describe, expect, it } from "vitest";

import { tryCatch } from "./try-catch";

describe("tryCatch", () => {
  it("should return a tuple with the result and undefined if the promise resolves", async () => {
    const promise = Promise.resolve("success");
    const result = await tryCatch(promise);
    expect(result).toEqual({ data: "success", error: null });
  });
  it("should return a tuple with undefined and the error if the promise rejects", async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const promise = Promise.reject("error");
    const result = await tryCatch(promise);
    expect(result).toEqual({ data: null, error: "error" });
  });
});
