import generateSlug from "./generate-slug.util";
import { describe, it } from "vitest";

describe("generateSlug", () => {
  it("should return a slug", async () => {
    const slug = generateSlug("Hello World");
    console.log(slug);
  });
});
