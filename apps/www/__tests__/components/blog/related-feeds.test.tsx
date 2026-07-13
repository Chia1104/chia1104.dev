import { render, screen } from "@testing-library/react";

import { RelatedFeeds } from "@/components/blog/related-feeds";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock("@/libs/i18n/routing", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("RelatedFeeds", () => {
  it("should render nothing when there are no recommendations", async () => {
    const view = await RelatedFeeds({ items: [] });

    expect(view).toBeNull();
  });

  it("should render links to related feeds", async () => {
    const view = await RelatedFeeds({
      items: [
        {
          id: 2,
          type: "note",
          slug: "related-note",
          locale: "zh-TW",
          title: "Related note",
          description: "A useful note",
          excerpt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          similarity: 0.9,
        },
      ],
    });

    render(view);

    expect(
      screen.getByRole("heading", { name: "related-feeds" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Related note/ })).toHaveAttribute(
      "href",
      "/notes/related-note"
    );
  });
});
