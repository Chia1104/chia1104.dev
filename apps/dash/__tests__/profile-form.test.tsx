import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Locale, ProfileEntryKind } from "@chia/db/types";

import { EntryForm } from "../src/components/profile/entry-form";
import {
  emptyFormValues,
  formValuesOf,
  profileFormResolver,
  toWrite,
} from "../src/components/profile/form";
import type { ProfileEntryView } from "../src/components/profile/form";

/**
 * The form is one flat shape; what reaches the API is decided by `toWrite` and refused by
 * the content schema, so most of the behaviour is testable without a DOM.
 */

const experience: ProfileEntryView = {
  id: 3,
  kind: ProfileEntryKind.Experience,
  published: true,
  sortOrder: 1,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  data: {
    organization: "LeadBest",
    url: "https://www.leadbestconsultant.com/",
    startDate: "2023-03",
    stack: ["TypeScript", "React"],
    translations: {
      [Locale.zhTW]: { title: "前端工程師", content: "- 開發多鏈錢包" },
    },
  },
};

const resolverOptions = { fields: {}, shouldUseNativeValidation: false };

describe("profile form mapping", () => {
  it("round-trips an entry through form values and back", () => {
    const values = formValuesOf(experience);
    expect(values.stack).toBe("TypeScript, React");
    expect(values.endDate).toBe("");
    expect(values.translations[Locale.En].title).toBe("");

    const write = toWrite(ProfileEntryKind.Experience, values);
    expect(write).toEqual({
      published: true,
      sortOrder: 1,
      kind: "experience",
      data: {
        organization: "LeadBest",
        url: "https://www.leadbestconsultant.com/",
        location: undefined,
        startDate: "2023-03",
        endDate: undefined,
        stack: ["TypeScript", "React"],
        translations: {
          "zh-TW": {
            title: "前端工程師",
            summary: undefined,
            content: "- 開發多鏈錢包",
          },
          en: undefined,
        },
      },
    });
  });

  it("splits the stack on commas and newlines and drops blanks", () => {
    const write = toWrite(ProfileEntryKind.Project, {
      ...emptyFormValues(),
      stack: "Next.js,\n Hono , ,Drizzle",
      translations: {
        ...emptyFormValues().translations,
        [Locale.En]: { title: "chia1104.dev", summary: "", content: "" },
      },
    });
    if (write.kind !== "project") throw new Error("kind mismatch");
    expect(write.data.stack).toEqual(["Next.js", "Hono", "Drizzle"]);
    expect(write.data.startDate).toBeUndefined();
  });

  it("maps schema issues onto fields and the rest onto root", async () => {
    const resolve = profileFormResolver(ProfileEntryKind.Experience);
    const result = await resolve(
      { ...emptyFormValues(), startDate: "2023-3" },
      undefined,
      resolverOptions
    );
    expect(result.errors).toMatchObject({
      organization: { message: expect.any(String) },
      startDate: { message: "Use YYYY-MM" },
      translations: { message: "At least one locale is required" },
    });

    const valid = await resolve(
      formValuesOf(experience),
      undefined,
      resolverOptions
    );
    expect(valid.errors).toEqual({});
  });
});

describe("EntryForm", () => {
  it("submits what the operator typed as a kind-correlated write", async () => {
    const onSubmit = vi.fn();
    render(
      <EntryForm
        isPending={false}
        kind={ProfileEntryKind.Education}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Organization" }), {
      target: { value: "CGU, IM" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Start" }), {
      target: { value: "2018-06" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "End" }), {
      target: { value: "2022-06" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "中文 title" }), {
      target: { value: "資訊管理學系" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      published: false,
      sortOrder: 0,
      kind: "education",
      data: {
        organization: "CGU, IM",
        url: undefined,
        startDate: "2018-06",
        endDate: "2022-06",
        translations: {
          "zh-TW": {
            title: "資訊管理學系",
            summary: undefined,
            content: undefined,
          },
          en: undefined,
        },
      },
    });
  });

  it("shows the schema's message on the field and does not submit", async () => {
    const onSubmit = vi.fn();
    render(
      <EntryForm
        isPending={false}
        kind={ProfileEntryKind.Experience}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Start" }), {
      target: { value: "March 2023" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(screen.getByText("Use YYYY-MM")).toBeDefined());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
