import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordAgentPromptScreen } = vi.hoisted(() => ({
  recordAgentPromptScreen: vi.fn(),
}));

vi.mock("@chia/db/repos/agent", () => ({ recordAgentPromptScreen }));

import { PromptRejectedError } from "@chia/api/orpc/services/prompt-screen";
import type { PromptScreenPort } from "@chia/api/orpc/services/prompt-screen";
import type { DB } from "@chia/db/client";

import { screenPrompt } from "../src/agents/screen";

/**
 * `screenPrompt` is the seam the generic `prompt()` calls: these pin that a kind without a
 * screen costs nothing, that every consulted verdict is recorded (allow included), and that a
 * failed record fails the request rather than letting the verdict and the audit trail diverge.
 */

const db = {} as DB;

const base = {
  db,
  userId: "user-1",
  sessionId: "session-1",
  kind: "public",
  text: "hello there",
};

const port = (verdict: Awaited<ReturnType<PromptScreenPort["screen"]>>) => ({
  screen: vi.fn(async () => verdict),
});

beforeEach(() => {
  recordAgentPromptScreen.mockReset().mockResolvedValue(undefined);
});

describe("screenPrompt", () => {
  it("does nothing for a kind without a screen", async () => {
    await screenPrompt({ ...base, screen: undefined });
    expect(recordAgentPromptScreen).not.toHaveBeenCalled();
  });

  it("records an allow verdict with the hash and length, never the text", async () => {
    const screen = port({
      verdict: "allow",
      signals: [{ source: "prompt-guard", label: "benign", score: 0.1 }],
    });

    await screenPrompt({ ...base, screen });

    expect(recordAgentPromptScreen).toHaveBeenCalledWith(db, {
      userId: "user-1",
      sessionId: "session-1",
      kind: "public",
      verdict: "allow",
      reason: undefined,
      signals: [{ source: "prompt-guard", label: "benign", score: 0.1 }],
      textHash: createHash("sha256").update(base.text).digest("hex"),
      textLength: base.text.length,
    });
  });

  it("records a block before throwing PromptRejectedError with the coarse reason", async () => {
    const screen = port({
      verdict: "block",
      reason: "injection",
      signals: [{ source: "prompt-guard", label: "malicious", score: 0.97 }],
    });

    const pending = screenPrompt({ ...base, screen });

    await expect(pending).rejects.toBeInstanceOf(PromptRejectedError);
    await expect(pending).rejects.toMatchObject({ reason: "injection" });
    expect(recordAgentPromptScreen).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ verdict: "block", reason: "injection" })
    );
  });

  it("fails the request when the record write fails, for either verdict", async () => {
    recordAgentPromptScreen.mockRejectedValue(new Error("insert failed"));

    await expect(
      screenPrompt({ ...base, screen: port({ verdict: "allow", signals: [] }) })
    ).rejects.toThrow("insert failed");

    await expect(
      screenPrompt({
        ...base,
        screen: port({ verdict: "block", reason: "harmful", signals: [] }),
      })
    ).rejects.toThrow("insert failed");
  });
});
