import { faker } from "@faker-js/faker";
import { db, schema } from "@chia/db";
import { feeds } from "../../../packages/db/src/schema";

if (!process.env.ADMIN_ID || !process.env.DATABASE_URL) {
  throw new Error("Missing env variables ADMIN_ID or DATABASE_URL");
}

const seedPost = async () => {
  await db.transaction(async (trx) => {
    const feed = await trx
      .insert(schema.feeds)
      .values({
        slug: faker.lorem.slug(),
        type: "post",
        title: faker.lorem.sentence(),
        expert: faker.lorem.paragraphs(),
        description: faker.lorem.paragraphs(),
        userId: process.env.ADMIN_ID!,
      })
      .returning({ feedId: feeds.id });
    await trx.insert(schema.posts).values({
      feedId: feed[0].feedId,
      content: faker.lorem.paragraphs(),
    });
  });
};

const seedActions = [seedPost];

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
  await actionFn();
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
