import { faker } from "@faker-js/faker";
import { db, schema } from "@chia/db";
import { feeds } from "@chia/db/schema";

if (!process.env.CHIA_ID) {
  throw new Error("CHIA_ID not set");
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
        userId: process.env.CHIA_ID!,
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
  console.log("Seeding", action);
  const actionFn = seedActions.find((a) => a.name === action);
  if (!actionFn) {
    throw new Error("Unknown action");
  }
  await actionFn();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
