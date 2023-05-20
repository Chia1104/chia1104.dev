import { describe, expect, it } from "vitest";
import { getShortDate } from "./day.util";

describe("getShortDate", () => {
  it("should return a short date 2022-09-30", () => {
    const date = new Date("2022-09-30T00:00:00.000Z");
    expect(getShortDate(date)).toEqual("2022-09-30");
  });
});
