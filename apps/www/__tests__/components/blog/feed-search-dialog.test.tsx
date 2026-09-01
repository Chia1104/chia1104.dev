import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FeedSearchDialog } from "@/components/blog/feed-search-dialog";

import { renderWithProviders } from "../../utils";

vi.mock("@/components/commons/feed-search", () => ({
  FeedSearch: ({ query }: { query: string }) => (
    <div data-testid="feed-search-results">{query}</div>
  ),
}));

describe("FeedSearchDialog", () => {
  it("opens from the blog navigation and renders search results", async () => {
    const user = userEvent.setup();

    renderWithProviders(<FeedSearchDialog locale="en-US" />);

    await user.click(screen.getByRole("button", { name: "search-articles" }));
    expect(screen.getByText("search-hint")).toBeInTheDocument();

    await user.type(screen.getByRole("combobox"), "React");

    expect(screen.getByTestId("feed-search-results")).toHaveTextContent(
      "React"
    );
  });
});
