import { describe, expect, it } from "vitest";

import {
  FeedReportCategory,
  FeedReportStatus,
  FeedReportVerdict,
} from "@chia/db/schema";
import type { FeedReport } from "@chia/db/schema";
import { Locale } from "@chia/db/types";

import { buildReportEmail } from "../src/steps/report-triage.step";

const report: FeedReport = {
  id: 42,
  feedId: 3,
  locale: Locale.En,
  headingPath: "Setup",
  quote: "npm i foo@1",
  category: FeedReportCategory.Outdated,
  claim: "foo 2 is out.\n<b>click http://evil.example</b>",
  assessment: "Plausible; the post pins foo 1.",
  suggestion: "npm i foo@2",
  reporterId: "reader",
  sessionId: "session-1",
  status: FeedReportStatus.Open,
  triage: {
    verdict: FeedReportVerdict.NeedsVerification,
    summary: "需要確認 foo 2 的安裝方式。",
    edits: [],
    droppedEdits: 0,
  },
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe("buildReportEmail", () => {
  it("quotes the reader's text and links the dashboard review", () => {
    const email = buildReportEmail(report, {
      title: "Foo",
      url: "https://chia1104.dev/en/posts/foo",
    });
    expect(email.subject).toBe("[Reader report] Foo");
    expect(email.text).toContain(
      "Reader's claim:\n    foo 2 is out.\n    <b>click http://evil.example</b>"
    );
    expect(email.text).toContain("Suggested fix:\n    npm i foo@2");
    expect(email.text).toContain("Triage: Needs verification");
    expect(email.text).toMatch(/Review: .+\/reports\/42$/);
  });

  it("says when triage did not run", () => {
    const email = buildReportEmail(
      { ...report, triage: null },
      { title: "Foo", url: "https://chia1104.dev/en/posts/foo" }
    );
    expect(email.text).toContain("Triage did not run");
  });
});
