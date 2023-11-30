import { faker } from "@faker-js/faker";
import { db, schema, localDb, betaDb, type DB } from "@chia/db";

const withReplicas = (
  fun: (database: DB, adminId: string, env?: string) => Promise<void> | void,
  options?: {
    env?: string;
  }
) => {
  const env = options?.env ?? process.env.NODE_ENV;
  const database = () => {
    switch (env) {
      case "production":
      case "prod": {
        return db;
      }
      case "beta": {
        return betaDb;
      }
      case "development":
      case "local": {
        return localDb;
      }
      default:
        throw new Error(`Unknown env: ${env}`);
    }
  };
  const adminId = () => {
    switch (env) {
      case "production":
      case "prod": {
        if (!process.env.ADMIN_ID)
          throw new Error("Missing env variables ADMIN_ID");
        return process.env.ADMIN_ID;
      }
      case "beta": {
        if (!process.env.BETA_ADMIN_ID)
          throw new Error("Missing env variables BETA_ADMIN_ID");
        return process.env.BETA_ADMIN_ID;
      }
      case "development":
      case "local": {
        if (!process.env.LOCAL_ADMIN_ID)
          throw new Error("Missing env variables LOCAL_ADMIN_ID");
        return process.env.LOCAL_ADMIN_ID;
      }
      default:
        throw new Error(`Unknown env: ${env}`);
    }
  };
  return async () => {
    await fun(database(), adminId(), env);
  };
};

const seedPost = withReplicas(
  async (db, adminId) => {
    await db.transaction(async (trx) => {
      const feed = await trx
        .insert(schema.feeds)
        .values({
          slug: faker.lorem.slug(),
          type: "post",
          title: faker.lorem.sentence(),
          expert: faker.lorem.paragraph(),
          description: faker.lorem.paragraph(),
          userId: adminId,
          published: true,
        })
        .returning({ feedId: schema.feeds.id });
      await trx.insert(schema.posts).values({
        feedId: feed[0].feedId,
        content: faker.lorem.paragraphs(),
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
          expert: faker.lorem.paragraph(),
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
