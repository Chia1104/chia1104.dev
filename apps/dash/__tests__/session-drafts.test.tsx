import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const { SessionDrafts } =
  await import("../src/components/agent/session-drafts");

describe("SessionDrafts", () => {
  it("opens the draft the operator picked in the editor", async () => {
    render(
      <SessionDrafts
        drafts={[
          {
            id: 7,
            feedId: null,
            revision: 1,
            appliedRevision: null,
            slug: null,
            type: "post",
            defaultLocale: "en",
            mainImage: null,
            translations: {
              en: {
                title: "Older draft",
                excerpt: null,
                description: null,
                summary: null,
                content: "Body",
              },
            },
            createdAt: "2026-09-05T00:00:00Z",
            updatedAt: "2026-09-05T00:00:00Z",
          },
        ]}
      />
    );
    fireEvent.click(screen.getByText("Older draft"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Open in editor" })
    );
    expect(navigation.push).toHaveBeenCalledWith("/feed/draft/7");
  });
});
