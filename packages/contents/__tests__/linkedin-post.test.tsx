import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LinkedInPost } from "../src/components/linkedin-post";

const URN = "urn:li:share:7492281174262890496";

describe("LinkedInPost", () => {
  it("embeds the collapsed post at its fixed height", () => {
    const html = renderToStaticMarkup(<LinkedInPost urn={URN} />);

    expect(html).toContain(
      `src="https://www.linkedin.com/embed/feed/update/${URN}?collapsed=1"`
    );
    expect(html).toContain('height="264"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain(
      `href="https://www.linkedin.com/feed/update/${URN}"`
    );
  });

  it("embeds the full post when not collapsed", () => {
    const html = renderToStaticMarkup(
      <LinkedInPost urn={URN} collapsed={false} height={700} />
    );

    expect(html).toContain(
      `src="https://www.linkedin.com/embed/feed/update/${URN}"`
    );
    expect(html).toContain('height="700"');
  });

  it("renders nothing for a malformed urn", () => {
    const html = renderToStaticMarkup(
      <LinkedInPost urn="https://www.linkedin.com/posts/example" />
    );

    expect(html).toBe("");
  });
});
