import { ParsedJSONError } from "./";
import { tryCatch } from "./";

describe("ParsedJSONError", () => {
  it("should throw a ParsedJSONError", () => {
    const error = new ParsedJSONError("{'123': '456'}");
    expect(error).toBeInstanceOf(ParsedJSONError);
  });

  it("should throw a ParsedJSONError when parsing invalid JSON", async () => {
    const parser = (input: unknown) => {
      try {
        JSON.parse(input as string);
      } catch {
        throw new ParsedJSONError(input);
      }
    };
    const { error } = await tryCatch(
      (async () => await Promise.resolve(parser("{'123': '456'}")))()
    );
    expect(error).toBeInstanceOf(ParsedJSONError);
    expect((error as unknown as ParsedJSONError).input).toBe("{'123': '456'}");
  });
});
