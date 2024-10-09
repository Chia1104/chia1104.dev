import type { Adapter, AdapterSession, AdapterUser } from "@auth/core/adapters";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import dayjs from "dayjs";

import type { Redis } from "@chia/cache";
import type { DB } from "@chia/db";
import { schema, eq } from "@chia/db";

const SESSION_PREFIX = "__auth_session:";

type CacheSession = Omit<AdapterSession, "expires"> & { expires: string };
type CacheUser = Omit<AdapterUser, "emailVerified"> & {
  emailVerified: string | null;
};

interface CacheSessionWithUser {
  session: CacheSession;
  user: CacheUser;
}

export const adapter = ({
  db,
  redis,
  sessionPrefix = SESSION_PREFIX,
}: {
  db: DB;
  redis: Redis;
  sessionPrefix?: string;
}) => {
  const drizzle = DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
    // authenticatorsTable: schema.authenticators,
  });

  const setObjectAsJson = async <TData = unknown>(
    key: string,
    data: TData,
    exp: number
  ) => await redis.set(key, JSON.stringify(data), "EX", exp);

  const setSession = async (session: AdapterSession, user: AdapterUser) => {
    await setObjectAsJson<CacheSessionWithUser>(
      `${sessionPrefix}${session.sessionToken}`,
      {
        session: { ...session, expires: dayjs(session.expires).toISOString() },
        user: {
          ...user,
          email: user.email ?? "",
          emailVerified: user.emailVerified
            ? dayjs(user.emailVerified).toISOString()
            : null,
        },
      },
      dayjs(session.expires).diff(dayjs(), "second")
    );
    return session;
  };

  const getCacheSession = async (sessionToken: string) => {
    const session = await redis.get(`${sessionPrefix}${sessionToken}`);
    if (!session) {
      return null;
    }
    return JSON.parse(session) as CacheSessionWithUser;
  };

  return {
    ...drizzle,
    createSession: async (session) => {
      const user = (
        await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, session.userId))
      )[0];
      return await setSession(
        session,
        // @ts-expect-error - email is not nullable
        user
      );
    },
    updateSession: async (updates) => {
      const cacheSession = await getCacheSession(updates.sessionToken);
      if (!cacheSession) {
        return null;
      }
      const user = (
        await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, cacheSession.session.userId))
      )[0];
      if (!user) return null;
      return await setSession(
        {
          ...cacheSession.session,
          expires: dayjs(cacheSession.session.expires).toDate(),
          ...updates,
        },
        // @ts-expect-error - email is not nullable
        user
      );
    },
    deleteSession: async (sessionToken) => {
      await redis.del(`${sessionPrefix}${sessionToken}`);
    },
    getSessionAndUser: async (sessionToken) => {
      const cacheSession = await getCacheSession(sessionToken);
      if (!cacheSession) {
        return null;
      }
      let user: Omit<AdapterUser, "email"> & { email: string | null };
      const userShouldRevalidate = await redis.get(
        `${sessionPrefix}user-revalidate:${cacheSession.user.id}`
      );
      if (userShouldRevalidate === "true") {
        user = (
          await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, cacheSession.user.id))
        )[0];
        await setSession(
          {
            ...cacheSession.session,
            expires: dayjs(cacheSession.session.expires).toDate(),
          },
          // @ts-expect-error - email is not nullable
          user
        );
        await redis.del(
          `${sessionPrefix}user-revalidate:${cacheSession.user.id}`
        );
      } else {
        user = {
          ...cacheSession.user,
          emailVerified: cacheSession.user.emailVerified
            ? dayjs(cacheSession.user.emailVerified).toDate()
            : null,
        };
      }
      return {
        session: {
          ...cacheSession.session,
          expires: dayjs(cacheSession.session.expires).toDate(),
        },
        user: user as AdapterUser,
      };
    },
  } satisfies Adapter;
};

export const updateCacheUser = async ({
  redis,
  userId,
  sessionPrefix = SESSION_PREFIX,
}: {
  redis: Redis;
  userId: string;
  sessionPrefix?: string;
}) => {
  await redis.set(`${sessionPrefix}user-revalidate:${userId}`, "true");
};
