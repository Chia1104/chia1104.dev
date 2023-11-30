export const getEnv = (env?: string) =>
  env ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;

export const getDb = <DB = unknown>(
  env?: string,
  // @ts-ignore
  {
    db,
    betaDb,
    localDb,
  }: {
    db: DB;
    betaDb: DB;
    localDb: DB;
  }
) => {
  switch (getEnv(env)) {
    case "production":
    case "prod": {
      return db;
    }
    case "preview":
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

export const getDbUrl = (env?: string) => {
  switch (getEnv(env)) {
    case "production":
    case "prod": {
      if (!process.env.DATABASE_URL)
        throw new Error("Missing env variables DATABASE_URL");
      return process.env.DATABASE_URL;
    }
    case "preview":
    case "beta": {
      if (!process.env.BETA_DATABASE_URL)
        throw new Error("Missing env variables BETA_DATABASE_URL");
      return process.env.BETA_DATABASE_URL;
    }
    case "development":
    case "local": {
      if (!process.env.LOCAL_DATABASE_URL)
        throw new Error("Missing env variables LOCAL_DATABASE_URL");
      return process.env.LOCAL_DATABASE_URL;
    }
    default:
      throw new Error(`Unknown env: ${env}`);
  }
};

export const getAdminId = (env?: string) => {
  switch (getEnv(env)) {
    case "production":
    case "prod": {
      if (!process.env.ADMIN_ID)
        throw new Error("Missing env variables ADMIN_ID");
      return process.env.ADMIN_ID;
    }
    case "preview":
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
