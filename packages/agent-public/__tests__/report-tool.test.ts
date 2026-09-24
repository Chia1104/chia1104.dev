import { describe, expect, it, vi } from "vitest";

import { FeedReportCategory } from "@chia/db/schema";
import { Locale } from "@chia/db/types";
import { createFakeContentReadPort } from "@chia/test/fixtures/content-read-port";
import { createFakeProfileReadPort } from "@chia/test/fixtures/profile-read-port";

import type { ReportIssueInput, ReportPort } from "../src/ports.ts";
import { preparePublicTurn } from "../src/runtime.ts";
import { ToolName } from "../src/tools/registry.ts";
import { createPublicReportTools } from "../src/tools/report.tool.ts";

const input: ReportIssueInput = {
  slug: "hello-world",
  locale: Locale.En,
  headingPath: "Setup > Install",
  quote: "Run npm i foo@1.",
  category: FeedReportCategory.Outdated,
  claim: "foo 2 changed the install command.",
  assessment: "The post pins foo 1; the claim is plausible but unchecked.",
};

const reportTool = (port: ReportPort) => {
  const [tool] = createPublicReportTools(port);
  if (!tool) throw new Error("expected the report tool");
  return (params: ReportIssueInput) =>
    tool
      .execute("call", params, undefined)
      .then((result) =>
        result.content.map((part) => ("text" in part ? part.text : "")).join("")
      );
};

describe("report_issue", () => {
  it("files the report through the port and sends one per turn", async () => {
    const submit = vi.fn(() => Promise.resolve({ id: 7 }));
    const report = reportTool({ submit });

    await expect(report(input)).resolves.toContain("Sent report #7");
    expect(submit).toHaveBeenCalledWith(input, undefined);
    await expect(report(input)).rejects.toThrow(/already sent a report/);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("lets a refused report be retried in the same turn", async () => {
    const submit = vi
      .fn<ReportPort["submit"]>()
      .mockRejectedValueOnce(new Error("No published post"))
      .mockResolvedValueOnce({ id: 8 });
    const report = reportTool({ submit });

    await expect(report(input)).rejects.toThrow("No published post");
    await expect(report(input)).resolves.toContain("Sent report #8");
  });
});

describe("preparePublicTurn reporting", () => {
  const base = {
    content: createFakeContentReadPort<never, never>(),
    profile: createFakeProfileReadPort([]),
    guard: null,
  };

  it("adds the tool and its step only with a report port", async () => {
    const granted = await preparePublicTurn({
      ...base,
      report: { submit: () => Promise.resolve({ id: 1 }) },
    });
    expect(granted.tools.map((tool) => tool.name)).toContain(
      ToolName.ReportIssue
    );
    expect(granted.systemPrompt).toContain("`report_issue`");

    const guest = await preparePublicTurn(base);
    expect(guest.tools.map((tool) => tool.name)).not.toContain(
      ToolName.ReportIssue
    );
    expect(guest.systemPrompt).not.toContain("report_issue");
    expect(guest.systemPrompt).toContain(
      "Corrections need a signed-in visitor"
    );
  });
});
