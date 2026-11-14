import { describe, expect, it } from "vitest";

import { Locale, MediaStatus } from "@chia/db/types";

import { mediaFormSchema } from "@/components/media/form";
import type { MediaFormInput } from "@/components/media/form";

const fields = (overrides: Partial<MediaFormInput> = {}): MediaFormInput => ({
  status: MediaStatus.Completed,
  rating: 8,
  favorite: false,
  startedOn: "",
  finishedOn: "2026-11-01",
  originalTitle: " 葬送のフリーレン ",
  releaseYear: 2023,
  translations: {
    [Locale.ZhTW]: { title: "葬送的芙莉蓮", comment: " 很好看 " },
    [Locale.En]: { title: "", comment: "ignored without a title" },
  },
  ...overrides,
});

describe("mediaFormSchema", () => {
  it("turns blank fields into nulls and drops a locale without a title", () => {
    expect(mediaFormSchema.parse(fields())).toEqual({
      status: MediaStatus.Completed,
      rating: 8,
      favorite: false,
      startedOn: null,
      finishedOn: "2026-11-01",
      originalTitle: "葬送のフリーレン",
      releaseYear: 2023,
      translations: {
        [Locale.ZhTW]: { title: "葬送的芙莉蓮", comment: "很好看" },
      },
    });
  });

  it("requires a title in at least one locale", () => {
    const result = mediaFormSchema.safeParse(
      fields({
        translations: {
          [Locale.ZhTW]: { title: " ", comment: "" },
          [Locale.En]: { title: "", comment: "" },
        },
      })
    );
    expect(result.success).toBe(false);
  });

  it("refuses a finish date before the start date", () => {
    const result = mediaFormSchema.safeParse(
      fields({ startedOn: "2026-11-02" })
    );
    expect(result.error?.issues[0]?.path).toEqual(["finishedOn"]);
  });
});
