import generateSlug from "./generate-slug.util";
import { getToday } from "../day/day.util";
import { describe, expect, it } from "vitest";

describe("generateSlug", () => {
  it("should return a slug", () => {
    const slug = generateSlug("Hello World");
    const today = getToday();
    expect(slug).toEqual(`${today}-hello-world`);
  });
});
