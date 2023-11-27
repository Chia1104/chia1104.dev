import { faker } from "@faker-js/faker";
import { db, schema, localDb } from "@chia/db";

const seedPost = async (env?: string) => {
  env === "prod"
    ? await db.transaction(async (trx) => {
        if (!process.env.ADMIN_ID || !process.env.DATABASE_URL) {
          throw new Error("Missing env variables ADMIN_ID or DATABASE_URL");
        }
        const feed = await trx
          .insert(schema.feeds)
          .values({
            slug: faker.lorem.slug(),
            type: "post",
            title: faker.lorem.sentence(),
            expert: faker.lorem.paragraph(),
            description: faker.lorem.paragraph(),
            userId: process.env.ADMIN_ID,
            published: true,
          })
          .returning({ feedId: schema.feeds.id });
        await trx.insert(schema.posts).values({
          feedId: feed[0].feedId,
          content: faker.lorem.paragraphs(),
        });
      })
    : await localDb.transaction(async (trx) => {
        if (!process.env.LOCAL_ADMIN_ID || !process.env.LOCAL_DATABASE_URL) {
          throw new Error(
            "Missing env variables LOCAL_ADMIN_ID or LOCAL_DATABASE_URL"
          );
        }
        const feed = await trx
          .insert(schema.feeds)
          .values({
            slug: faker.lorem.slug(),
            type: "post",
            title: faker.lorem.sentence(),
            expert: faker.lorem.paragraph(),
            description: faker.lorem.paragraph(),
            userId: process.env.LOCAL_ADMIN_ID,
            published: true,
          })
          .returning({ feedId: schema.feeds.id });
        await trx.insert(schema.posts).values({
          feedId: feed[0].feedId,
          content: faker.lorem.paragraphs(),
        });
      });
};

const seedNote = async (env?: string) => {
  env === "prod"
    ? await db.transaction(async (trx) => {
        if (!process.env.ADMIN_ID || !process.env.DATABASE_URL) {
          throw new Error("Missing env variables ADMIN_ID or DATABASE_URL");
        }
        const feed = await trx
          .insert(schema.feeds)
          .values({
            slug: faker.lorem.slug(),
            type: "note",
            title: faker.lorem.sentence(),
            expert: faker.lorem.paragraph(),
            description: faker.lorem.paragraph(),
            userId: process.env.ADMIN_ID,
            published: true,
          })
          .returning({ feedId: schema.feeds.id });
        await trx.insert(schema.notes).values({
          feedId: feed[0].feedId,
          content: faker.lorem.paragraphs(),
        });
      })
    : await localDb.transaction(async (trx) => {
        if (!process.env.LOCAL_ADMIN_ID || !process.env.LOCAL_DATABASE_URL) {
          throw new Error(
            "Missing env variables LOCAL_ADMIN_ID or LOCAL_DATABASE_URL"
          );
        }
        const feed = await trx
          .insert(schema.feeds)
          .values({
            slug: faker.lorem.slug(),
            type: "note",
            title: faker.lorem.sentence(),
            expert: faker.lorem.paragraph(),
            description: faker.lorem.paragraph(),
            userId: process.env.LOCAL_ADMIN_ID,
            published: true,
          })
          .returning({ feedId: schema.feeds.id });
        await trx.insert(schema.notes).values({
          feedId: feed[0].feedId,
          content: faker.lorem.paragraphs(),
        });
      });
};

const seedActions = [seedPost, seedNote];

const seed = async () => {
  const action = process.argv[2];
  const env = process.argv[3] ?? "local";
  if (!action) {
    throw new Error("No action provided");
  }
  const actionFn = seedActions.find((a) => a.name === action);
  if (!actionFn) {
    throw new Error("Unknown action");
  }
  console.log("Seeding", action);
  await actionFn(env);
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
