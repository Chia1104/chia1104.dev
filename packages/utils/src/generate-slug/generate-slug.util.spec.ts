import generateSlug from "./generate-slug.util";
import { describe, it } from "vitest";

describe("generateSlug", () => {
  it("should return a slug", () => {
    const slug = generateSlug("Hello World");
    console.log(slug);
  });
});
