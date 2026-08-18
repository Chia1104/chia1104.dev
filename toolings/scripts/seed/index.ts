import { faker } from "@faker-js/faker";

import { schema } from "@chia/db";
import type { DB } from "@chia/db";
import { connectDatabase } from "@chia/db/client";
import { getAdminId } from "@chia/utils/config";

const withReplicas = (
  fun: (database: DB, adminId: string, env?: string) => Promise<void> | void,
  options?: {
    env?: string;
  }
) => {
  const env = options?.env ?? process.env.NODE_ENV;
  return async () => {
    await fun(await connectDatabase(env), getAdminId(env), env);
  };
};

const getCLIOptions = <TOptions extends Record<string, string>>(): TOptions => {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  args.forEach((arg) => {
    const [key, value] = arg.split("=");
    if (!key || !value) {
      return;
    }
    options[key] = value;
  });

  return /* SAFETY: The producer contract guarantees this value satisfies TOptions. */ options as TOptions;
};

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

/**
 * One feed with a zh-TW translation and two tags.
 *
 * The body goes straight into `feed_translation.content` — there is no
 * separate content table and no embedding column any more. Search vectors are
 * the indexing workflow's job (`docs/rag-architecture.md`); seeded rows get
 * them from a reindex, not from the seed.
 */
const seedFeed = (type: "post" | "note") =>
  withReplicas(
    async (db, adminId) => {
      await db.transaction(async (trx) => {
        let tags = await trx.select().from(schema.tags);
        if (tags.length === 0) {
          tags = await trx
            .insert(schema.tags)
            .values([{ slug: "tag1" }, { slug: "tag2" }])
            .returning();

          if (tags[0]?.id && tags[1]?.id) {
            await trx.insert(schema.tagTranslations).values([
              {
                tagId: tags[0].id,
                locale: "zh-TW",
                name: "標籤 1",
                description: "這是標籤 1 的描述",
              },
              {
                tagId: tags[1].id,
                locale: "zh-TW",
                name: "標籤 2",
                description: "這是標籤 2 的描述",
              },
            ]);
          }
        }

        const feed = await trx
          .insert(schema.feeds)
          .values({
            slug: faker.lorem.slug(),
            type,
            userId: adminId,
            published: true,
            defaultLocale: "zh-TW",
            contentType: "mdx",
          })
          .returning({ feedId: schema.feeds.id });

        if (!feed[0]?.feedId) {
          throw new Error("Feed ID not found");
        }
        if (!tags[0]?.id || !tags[1]?.id) {
          throw new Error("Tag ID not found");
        }

        await trx.insert(schema.feedsToTags).values([
          { feedId: feed[0].feedId, tagId: tags[0].id },
          { feedId: feed[0].feedId, tagId: tags[1].id },
        ]);

        await trx.insert(schema.feedTranslations).values({
          feedId: feed[0].feedId,
          locale: "zh-TW",
          title: faker.lorem.sentence(),
          excerpt: faker.lorem.paragraph(),
          description: faker.lorem.paragraph(),
          summary: faker.lorem.paragraph(),
          readTime: Math.floor(Math.random() * 10) + 1,
          content: CONTENT,
          source: CONTENT,
        });
      });
    },
    {
      env: getCLIOptions().env ?? "local",
    }
  );

const seedActions = [
  { name: "seedPost", fn: seedFeed("post") },
  { name: "seedNote", fn: seedFeed("note") },
];

const seed = async () => {
  const action = getCLIOptions().action;
  if (!action) {
    throw new Error("No action provided");
  }
  const actionFn = seedActions.find((a) => a.name === action);
  if (!actionFn) {
    throw new Error("Unknown action");
  }
  console.log("Seeding", action);
  await actionFn.fn();
};

seed()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
