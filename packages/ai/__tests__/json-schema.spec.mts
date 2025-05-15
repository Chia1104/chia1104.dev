import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

describe("json schema test", () => {
  it("test output json schema", () => {
    const fooSchema = z.object({
      foo: z.string(),
    });

    console.log(zodResponseFormat(fooSchema, "foo"));
  });
});
