import { faker } from "@faker-js/faker";

import { db, schema, localDb, betaDb } from "@chia/db";
import type { DB } from "@chia/db";
import { getDb, getAdminId } from "@chia/utils";

const withReplicas = (
  fun: (database: DB, adminId: string, env?: string) => Promise<void> | void,
  options?: {
    env?: string;
  }
) => {
  const env = options?.env ?? process.env.NODE_ENV;
  const database = getDb(env, {
    db,
    betaDb,
    localDb,
  });
  const adminId = getAdminId(env);
  return async () => {
    await fun(database, adminId, env);
  };
};

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
      await trx.insert(schema.posts).values({
        feedId: feed[0].feedId,
        content:
          `
# Heading 1
 
## Heading 2
 
### Heading 3
 
#### Heading 4
 
Hello World, **Bold**, _Italic_, ~~Hidden~~

1. First
2. Second
3. Third
 
- Item 1
- Item 2
 
> Quote here
 
 
| Table | Description |
| ----- | ----------- |
| Hello | World       |
 
` +
          `${"```"}` +
          `${`js
console.log('Hello World');`}` +
          `${`
`}` +
          `${"```"}`,
      });
    });
  },
  {
    env: process.argv[3] ?? "local",
  }
);

const seedNote = withReplicas(
  async (db, adminId) => {
    await db.transaction(async (trx) => {
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
      await trx.insert(schema.notes).values({
        feedId: feed[0].feedId,
        content: faker.lorem.paragraphs(),
      });
    });
  },
  {
    env: process.argv[3] ?? "local",
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
  const action = process.argv[2];
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
