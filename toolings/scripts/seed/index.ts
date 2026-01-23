import { faker } from "@faker-js/faker";

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
            },
            {
              slug: "tag2",
            },
          ])
          .returning();

        // Create tag translations
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

      // 1. Create feed (base info only)
      const feed = await trx
        .insert(schema.feeds)
        .values({
          slug: faker.lorem.slug(),
          type: "post",
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

      // 2. Create feed tags
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

      // 3. Generate embedding if needed
      const withEmbedding =
        getCLIOptions().withEmbedding === "true" ||
        getCLIOptions().withEmbedding === "1";

      const { data: embeddingData, error: embeddingError } = await tryCatch(
        withEmbedding
          ? generateEmbedding(CONTENT)
          : Promise.reject(new Error("disable embedding"))
      );

      if (embeddingError) {
        console.info("Failed to generate embedding:", embeddingError);
      }

      // 4. Create feed translation (zh-TW)
      const translation = await trx
        .insert(schema.feedTranslations)
        .values({
          feedId: feed[0].feedId,
          locale: "zh-TW",
          title: faker.lorem.sentence(),
          excerpt: faker.lorem.paragraph(),
          description: faker.lorem.paragraph(),
          summary: faker.lorem.paragraph(),
          readTime: Math.floor(Math.random() * 10) + 1,
          embedding: embeddingData ?? undefined,
        })
        .returning({ translationId: schema.feedTranslations.id });

      if (!translation[0]?.translationId) {
        throw new Error("Translation ID not found");
      }

      // 5. Create content
      await trx.insert(schema.contents).values({
        feedTranslationId: translation[0].translationId,
        content: CONTENT,
        source: CONTENT,
      });
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
            },
            {
              slug: "tag2",
            },
          ])
          .returning();

        // Create tag translations
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

      // 1. Create feed (base info only)
      const feed = await trx
        .insert(schema.feeds)
        .values({
          slug: faker.lorem.slug(),
          type: "note",
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

      // 2. Create feed tags
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

      // 3. Generate embedding if needed
      const withEmbedding =
        getCLIOptions().withEmbedding === "true" ||
        getCLIOptions().withEmbedding === "1";

      const { data: embeddingData, error: embeddingError } = await tryCatch(
        withEmbedding
          ? generateEmbedding(CONTENT)
          : Promise.reject(new Error("disable embedding"))
      );

      if (embeddingError) {
        console.info("Failed to generate embedding:", embeddingError);
      }

      // 4. Create feed translation (zh-TW)
      const translation = await trx
        .insert(schema.feedTranslations)
        .values({
          feedId: feed[0].feedId,
          locale: "zh-TW",
          title: faker.lorem.sentence(),
          excerpt: faker.lorem.paragraph(),
          description: faker.lorem.paragraph(),
          summary: faker.lorem.paragraph(),
          readTime: Math.floor(Math.random() * 10) + 1,
          embedding: embeddingData ?? undefined,
        })
        .returning({ translationId: schema.feedTranslations.id });

      if (!translation[0]?.translationId) {
        throw new Error("Translation ID not found");
      }

      // 5. Create content
      await trx.insert(schema.contents).values({
        feedTranslationId: translation[0].translationId,
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
