import { describe, expect, it, vi } from "vitest";
import { cleanMdxKeepStructure, stripMdx } from "../src/embeddings/markdown";

const CONTENT = `
# Heading 1 - Foo

## Heading 2 - Bar

### Heading 3 - Baz

#### Heading 4

Hello World, **Bold**, _Italic_, ~~Hidden~~

<Banner>Hello World</Banner>

1. First
2. Second
3. Third

- Item 1
- Item 2

> Quote here

[chia1104](https://chia1104.dev)

![Image](https://storage.chia1104.dev/chia1104.png)

| Table | Description |
| ----- | ----------- |
| Hello | World       |
| foo   | bar         |

<Tabs items={['Javascript', 'Rust']}>
  <Tab value="Javascript">Javascript is weird</Tab>
  <Tab value="Rust">Rust is fast</Tab>
</Tabs>

\`\`\`js
console.log('Hello World');
\`\`\`
`;

describe("stripMdx", () => {
  it("flattens MDX to plain prose without code or markup", async () => {
    const result = await stripMdx(CONTENT);
    expect(result).toBe(
      "Heading 1 - Foo Heading 2 - Bar Heading 3 - Baz Heading 4 Hello World, Bold, Italic, Hidden Hello World First Second Third Item 1 Item 2 Quote here chia1104 Image Table Description Hello World foo bar Javascript is weird Rust is fast"
    );
    // fenced code must not reach the topic vector
    expect(result).not.toContain("console.log");
  });
});

describe("cleanMdxKeepStructure", () => {
  it("does not expose HTML tags assembled by cleanup", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await expect(
        cleanMdxKeepStructure("<scr<script>ipt>alert(1)</scr</script>ipt>")
      ).resolves.toBe("\\<script>alert(1)\\</script>");
      await expect(
        cleanMdxKeepStructure(
          "<scr[ip](https://example.com)t>alert(1)</scr[ip](https://example.com)t>"
        )
      ).resolves.toBe("\\<script>alert(1)\\</script>");
      await expect(
        cleanMdxKeepStructure("![<script>](https://example.com/image.png)")
      ).resolves.toBe("\\<script>");
      await expect(
        cleanMdxKeepStructure(
          "<!-- comment -->\n\n<div>alpha<br>beta</div>\n\n<broken<"
        )
      ).resolves.toBe("alpha\nbeta\\<broken<");
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps literal HTML examples inside code", async () => {
    const source = [
      "`<script>inline example</script>`",
      "",
      "```html",
      "<script>block example</script>",
      "```",
      "",
      "````md",
      "before",
      "```",
      "<script>nested fence example</script>",
      "````",
    ].join("\n");

    await expect(cleanMdxKeepStructure(source)).resolves.toBe(source);
  });

  it("bounds long code blocks and removes fence metadata", async () => {
    const source = [
      '```ts title="ignored"',
      ...Array.from({ length: 30 }, (_, index) => `line ${index}`),
      "```",
    ].join("\n");

    await expect(cleanMdxKeepStructure(source)).resolves.toBe(
      [
        "```ts",
        ...Array.from({ length: 12 }, (_, index) => `line ${index}`),
        "…",
        "```",
      ].join("\n")
    );
  });

  it("normalizes MDX and GFM to canonical markdown", async () => {
    const source = [
      'import Banner from "./banner"',
      "",
      "# Heading",
      "",
      "<Banner>",
      "Hello {name} **world**",
      "</Banner>",
      "",
      "- [x] done",
      "- [ ] pending",
      "",
      "[link label][docs]",
      "",
      "![image alt](https://example.com/image.png)",
      "",
      "~~deleted~~",
      "",
      "| A | B |",
      "| - | - |",
      "| x | y |",
      "",
      "[docs]: https://example.com/docs",
    ].join("\n");

    await expect(cleanMdxKeepStructure(source)).resolves.toBe(
      [
        "# Heading",
        "",
        "Hello  **world**",
        "",
        "- [x] done",
        "- [ ] pending",
        "",
        "link label",
        "",
        "image alt",
        "",
        "~~deleted~~",
        "",
        "| A | B |",
        "| - | - |",
        "| x | y |",
      ].join("\n")
    );
  });
});
