import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Tweet, TweetCard } from "../src/components/tweet";

const ID = "1683920951807971329";

describe("Tweet", () => {
  it("links to the post when the host does not fetch it", () => {
    const html = renderToStaticMarkup(<Tweet id={ID} />);

    expect(html).toContain(`href="https://x.com/i/status/${ID}"`);
  });

  it("renders nothing for an id that is not numeric", () => {
    expect(renderToStaticMarkup(<Tweet id="vercel" />)).toBe("");
  });
});

describe("TweetCard", () => {
  it("falls back to a not-found card with a link", () => {
    const html = renderToStaticMarkup(<TweetCard id={ID} />);

    expect(html).toContain("react-tweet-theme");
    expect(html).toContain(`href="https://x.com/i/status/${ID}"`);
  });
});
