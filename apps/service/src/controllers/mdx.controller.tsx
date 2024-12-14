import { reactRenderer } from "@hono/react-renderer";
import { Hono } from "hono";

import { compileMDX } from "@chia/contents/services";

const api = new Hono<HonoContext>();

const CONTENT =
  `
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

| Table | Description |
| ----- | ----------- |
| Hello | World       |
| foo   | bar         |

<Tabs items={['Javascript', 'Rust']}>
  <Tab value="Javascript">Javascript is weird</Tab>
  <Tab value="Rust">Rust is fast</Tab>
</Tabs>
 
` +
  `${"```"}` +
  `${`js
console.log('Hello World');`}` +
  `${`
`}` +
  `${"```"}`;

api.get(
  "*",
  reactRenderer(
    ({ children }) => {
      return (
        <html>
          <body>
            <div>{children}</div>
          </body>
        </html>
      );
    },
    {
      stream: true,
    }
  )
);

api.get("/compile", async (c) => {
  const compiled = await compileMDX(CONTENT);
  return c.render(<div>{compiled.content}</div>);
});

export default api;
