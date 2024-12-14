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
          <body className="main c-container prose dark:prose-invert mt-10 md:mt-20 w-full items-start justify-start">
            <div className="flex w-full flex-col items-center">{children}</div>
          </body>
        </html>
      );
    },
    {
      stream: true,
    }
  )
);

/**
 * EXPERIMENTAL FEATURES
 */
api.get("/preview", async (c) => {
  const compiled = await compileMDX(CONTENT);
  return c.render(
    <div className="prose dark:prose-invert w-full min-w-full lg:w-[70%] lg:min-w-[70%]">
      {compiled.content}
    </div>
  );
});

export default api;
