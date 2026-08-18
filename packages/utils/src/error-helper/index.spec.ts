import { ParsedJSONError } from "./";
import { tryCatch } from "./";

describe("ParsedJSONError", () => {
  it("should throw a ParsedJSONError", () => {
    const error = new ParsedJSONError("{'123': '456'}");
    expect(error).toBeInstanceOf(ParsedJSONError);
  });

  it("should throw a ParsedJSONError when parsing invalid JSON", async () => {
    const parser = (input: string) => {
      try {
        JSON.parse(input);
      } catch {
        throw new ParsedJSONError(input);
      }
    };
    const { error } = await tryCatch(
      (async () => await Promise.resolve(parser("{'123': '456'}")))()
    );
    expect(error).toBeInstanceOf(ParsedJSONError);
    if (!(error instanceof ParsedJSONError)) throw error;
    expect(error.input).toBe("{'123': '456'}");
  });
});
