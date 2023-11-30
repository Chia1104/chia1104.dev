export const getEnv = (env?: string) =>
  env ??
  process.env.VERCEL_ENV ??
  process.env.ENV ??
  process.env.NEXT_PUBLIC_ENV ??
  process.env.NODE_ENV ??
  "local";

export const switchEnv = <TResult = unknown>(
  env: string,
  {
    prod,
    beta,
    local,
  }: {
    prod: () => TResult;
    beta: () => TResult;
    local: () => TResult;
  }
) => {
  switch (getEnv(env)) {
    case "production":
    case "prod": {
      return prod();
    }
    case "preview":
    case "beta": {
      return beta();
    }
    case "development":
    case "local": {
      return local();
    }
    default:
      throw new Error(`Unknown env: ${env}`);
  }
};

export const getDb = <DB = unknown>(
  env: string | undefined,
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
  return switchEnv(getEnv(env), {
    prod: () => db,
    beta: () => betaDb,
    local: () => localDb,
  });
};

export const getDbUrl = (env?: string) => {
  return switchEnv(getEnv(env), {
    prod: () => {
      if (!process.env.DATABASE_URL)
        throw new Error("Missing env variables DATABASE_URL");
      return process.env.DATABASE_URL;
    },
    beta: () => {
      if (!process.env.BETA_DATABASE_URL)
        throw new Error("Missing env variables BETA_DATABASE_URL");
      return process.env.BETA_DATABASE_URL;
    },
    local: () => {
      if (!process.env.LOCAL_DATABASE_URL)
        throw new Error("Missing env variables LOCAL_DATABASE_URL");
      return process.env.LOCAL_DATABASE_URL;
    },
  });
};

export const getAdminId = (env?: string) => {
  return switchEnv(getEnv(env), {
    prod: () => {
      if (!process.env.ADMIN_ID)
        throw new Error("Missing env variables ADMIN_ID");
      return process.env.ADMIN_ID;
    },
    beta: () => {
      if (!process.env.BETA_ADMIN_ID)
        throw new Error("Missing env variables BETA_ADMIN_ID");
      return process.env.BETA_ADMIN_ID;
    },
    local: () => {
      if (!process.env.LOCAL_ADMIN_ID)
        throw new Error("Missing env variables LOCAL_ADMIN_ID");
      return process.env.LOCAL_ADMIN_ID;
    },
  });
};
