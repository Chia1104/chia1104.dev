import { zodResponseFormat } from "openai/helpers/zod";
import { describe, it } from "vitest";
import * as z from "zod";

describe("json schema test", () => {
  it("test output json schema", () => {
    const fooSchema = z.object({
      foo: z.string(),
    });

    console.log(zodResponseFormat(fooSchema, "foo"));
  });
});
