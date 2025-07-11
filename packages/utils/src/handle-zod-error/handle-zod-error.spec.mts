import { describe, it, expect } from "vitest";
import { z } from "zod";

import handleZodError from "./handle-zod-error";

describe("handleZodError", () => {
  it("should return isError true", () => {
    const result = handleZodError({
      schema: z.string(),
      // @ts-ignore
      data: 123,
    });
    expect(result.isError).toBe(true);
  });

  it("should return isError false", () => {
    const result = handleZodError({
      schema: z.string(),
      data: "123",
    });
    expect(result.isError).toBe(false);
  });

  it("should return isError true with message", () => {
    const result = handleZodError({
      schema: z.string(),
      // @ts-ignore
      data: 123,
      prefixErrorMessage: "Error: ",
    });
    expect(result.isError).toBe(true);
  });

  it("should return isError true with multiple issues", () => {
    const result = handleZodError({
      schema: z.object({
        name: z.string(),
        age: z.number(),
      }),
      data: {
        // @ts-ignore
        name: 123,
        // @ts-ignore
        age: "123",
      },
      prefixErrorMessage: "Error: ",
    });
    expect(result.isError).toBe(true);
  });

  it("should return custom message", () => {
    const result = handleZodError({
      schema: z.string().min(5, "Custom message"),
      data: "123",
      prefixErrorMessage: "Error: ",
    });
    expect(result.isError).toBe(true);
  });
});
