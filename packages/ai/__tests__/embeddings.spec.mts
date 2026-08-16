import { stripMdx } from "../src/embeddings/markdown";

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
