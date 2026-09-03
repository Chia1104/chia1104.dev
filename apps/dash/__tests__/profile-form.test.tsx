import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Locale, ProfileEntryKind } from "@chia/db/types";

import { EntryForm } from "../src/components/profile/entry-form";
import {
  emptyFormValues,
  formValuesOf,
  profileFormSchema,
} from "../src/components/profile/form";
import type { ProfileEntryView } from "../src/components/profile/form";

/**
 * The form is one flat shape; `profileFormSchema` turns it into the write payload and is
 * the only validation, so most of the behaviour is testable without a DOM.
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
    startDate: "2023-03-01",
    stack: ["TypeScript", "React"],
    agentNotes: "A consultancy.",
    translations: {
      [Locale.zhTW]: { title: "前端工程師", content: "- 開發多鏈錢包" },
    },
  },
};

describe("profileFormSchema", () => {
  it("round-trips an entry through form values and back", () => {
    const values = formValuesOf(experience);
    expect(values.data.stack).toBe("TypeScript, React");
    expect(values.data.endDate).toBe("");
    expect(values.data.translations[Locale.En].title).toBe("");
    expect(values.data.agentNotes).toBe("A consultancy.");

    expect(profileFormSchema.parse(values)).toEqual({
      published: true,
      sortOrder: 1,
      kind: "experience",
      data: {
        organization: "LeadBest",
        url: "https://www.leadbestconsultant.com/",
        startDate: "2023-03-01",
        stack: ["TypeScript", "React"],
        agentNotes: "A consultancy.",
        translations: {
          "zh-TW": { title: "前端工程師", content: "- 開發多鏈錢包" },
        },
      },
    });
  });

  it("splits the stack on commas and newlines and drops blanks", () => {
    const empty = emptyFormValues(ProfileEntryKind.Project);
    const write = profileFormSchema.parse({
      ...empty,
      data: {
        ...empty.data,
        stack: "Next.js,\n Hono , ,Drizzle",
        translations: {
          ...empty.data.translations,
          [Locale.En]: { title: "chia1104.dev", summary: "", content: "" },
        },
      },
    });
    if (write.kind !== "project") throw new Error("kind mismatch");
    expect(write.data.stack).toEqual(["Next.js", "Hono", "Drizzle"]);
    expect(write.data.startDate).toBeUndefined();
  });

  it("reports the data schema's issues at the form's field paths", () => {
    const empty = emptyFormValues(ProfileEntryKind.Experience);
    const result = profileFormSchema.safeParse({
      ...empty,
      data: { ...empty.data, startDate: "2023-03" },
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining([
        "data.organization",
        "data.startDate",
        "data.translations",
      ])
    );
  });
});

const education: ProfileEntryView = {
  id: 4,
  kind: ProfileEntryKind.Education,
  published: false,
  sortOrder: 0,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  data: {
    organization: "CGU",
    startDate: "2018-06-01",
    endDate: "2022-06-30",
    translations: { [Locale.zhTW]: { title: "資訊管理學系" } },
  },
};

describe("EntryForm", () => {
  it("submits the edited entry as a kind-correlated write and keeps the dates", async () => {
    const onSubmit = vi.fn();
    render(
      <EntryForm
        entry={education}
        isPending={false}
        kind={ProfileEntryKind.Education}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Organization" }), {
      target: { value: "CGU, IM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      published: false,
      sortOrder: 0,
      kind: "education",
      data: {
        organization: "CGU, IM",
        startDate: "2018-06-01",
        endDate: "2022-06-30",
        translations: { "zh-TW": { title: "資訊管理學系" } },
      },
    });
  });

  it("shows the schema's message and does not submit an entry without a locale", async () => {
    const onSubmit = vi.fn();
    render(
      <EntryForm
        isPending={false}
        kind={ProfileEntryKind.Experience}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Organization" }), {
      target: { value: "LeadBest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(screen.getByText("At least one locale is required")).toBeDefined()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
