import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { isOllamaEnabled } from "../src/utils";

describe("json schema test", () => {
  it("test output json schema", () => {
    const fooSchema = z.object({
      foo: z.string(),
    });

    console.log(zodResponseFormat(fooSchema, "foo"));
  });
});

describe("test ollama", () => {
  it("test ollama", async () => {
    const isEnabled = await isOllamaEnabled();
    console.log(isEnabled);
  });
});
