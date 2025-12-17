import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";

import { generateEmbedding } from "@chia/ai/embeddings/openai";
import { schema } from "@chia/db";
import type { DB } from "@chia/db";
import { connectDatabase } from "@chia/db/client";
import { getAdminId } from "@chia/utils/config";
import { tryCatch } from "@chia/utils/error-helper";

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

  return options as TOptions;
};

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

![Image](https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/www/group-2.JPG)

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

const seedPost = withReplicas(
  async (db, adminId) => {
    await db.transaction(async (trx) => {
      let tags = await trx.select().from(schema.tags);
      if (tags.length === 0) {
        tags = await trx
          .insert(schema.tags)
          .values([
            {
              slug: "tag1",
              name: "Tag 1",
            },
            {
              slug: "tag2",
              name: "Tag 2",
            },
          ])
          .returning();
      }
      const feed = await trx
        .insert(schema.feeds)
        .values({
          slug: faker.lorem.slug(),
          type: "post",
          title: faker.lorem.sentence(),
          excerpt: faker.lorem.paragraph(),
          description: faker.lorem.paragraph(),
          userId: adminId,
          published: true,
        })
        .returning({ feedId: schema.feeds.id });
      if (!feed[0]?.feedId) {
        throw new Error("Feed ID not found");
      }
      if (!tags[0]?.id || !tags[1]?.id) {
        throw new Error("Tag ID not found");
      }
      await trx.insert(schema.feedsToTags).values([
        {
          feedId: feed[0].feedId,
          tagId: tags[0].id,
        },
        {
          feedId: feed[0].feedId,
          tagId: tags[1].id,
        },
      ]);
      await trx.insert(schema.contents).values({
        feedId: feed[0].feedId,
        content: CONTENT,
      });

      const withEmbedding =
        getCLIOptions().withEmbedding === "true" ||
        getCLIOptions().withEmbedding === "1";

      const { data, error } = await tryCatch(
        withEmbedding
          ? generateEmbedding(CONTENT)
          : // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/prefer-promise-reject-errors
            Promise.reject("disable embedding")
      );
      if (error) {
        console.info("Failed to generate embedding:", error);
      } else {
        await trx
          .update(schema.feeds)
          .set({
            embedding: data,
          })
          .where(eq(schema.feeds.id, feed[0].feedId));
      }
    });
  },
  {
    env: getCLIOptions().env ?? "local",
  }
);

const seedNote = withReplicas(
  async (db, adminId) => {
    await db.transaction(async (trx) => {
      let tags = await trx.select().from(schema.tags);
      if (tags.length === 0) {
        tags = await trx
          .insert(schema.tags)
          .values([
            {
              slug: "tag1",
              name: "Tag 1",
            },
            {
              slug: "tag2",
              name: "Tag 2",
            },
          ])
          .returning();
      }
      const feed = await trx
        .insert(schema.feeds)
        .values({
          slug: faker.lorem.slug(),
          type: "note",
          title: faker.lorem.sentence(),
          excerpt: faker.lorem.paragraph(),
          description: faker.lorem.paragraph(),
          userId: adminId,
          published: true,
        })
        .returning({ feedId: schema.feeds.id });
      if (!feed[0]?.feedId) {
        throw new Error("Feed ID not found");
      }
      if (!tags[0]?.id || !tags[1]?.id) {
        throw new Error("Tag ID not found");
      }
      await trx.insert(schema.feedsToTags).values([
        {
          feedId: feed[0].feedId,
          tagId: tags[0].id,
        },
        {
          feedId: feed[0].feedId,
          tagId: tags[1].id,
        },
      ]);
      await trx.insert(schema.contents).values({
        feedId: feed[0].feedId,
        content: CONTENT,
      });

      const withEmbedding =
        getCLIOptions().withEmbedding === "true" ||
        getCLIOptions().withEmbedding === "1";

      const { data, error } = await tryCatch(
        withEmbedding
          ? generateEmbedding(CONTENT)
          : // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/prefer-promise-reject-errors
            Promise.reject("disable embedding")
      );
      if (error) {
        console.info("Failed to generate embedding:", error);
      } else {
        await trx
          .update(schema.feeds)
          .set({
            embedding: data,
          })
          .where(eq(schema.feeds.id, feed[0].feedId));
      }
    });
  },
  {
    env: getCLIOptions().env ?? "local",
  }
);

const seedActions = [
  {
    name: "seedPost",
    fn: seedPost,
  },
  {
    name: "seedNote",
    fn: seedNote,
  },
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
