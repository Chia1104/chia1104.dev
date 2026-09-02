import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import dayjs from "@chia/utils/day";

import * as schema from "../../schemas/schema.ts";
import { FeedOrderBy } from "../../types";
import { parseCursorForOrder, sliceNextCursor, withDTO } from "../index.ts";
import type { ListUsersDTO } from "../validator/users";

const USER_DATE_ORDER_BY = new Set([
  FeedOrderBy.UpdatedAt,
  FeedOrderBy.CreatedAt,
]);

const toISO = (date: Date | null) => (date ? dayjs(date).toISOString() : null);

const userColumns = {
  id: schema.user.id,
  name: schema.user.name,
  email: schema.user.email,
  image: schema.user.image,
  role: schema.user.role,
  isAnonymous: schema.user.isAnonymous,
  banned: schema.user.banned,
  banReason: schema.user.banReason,
  banExpires: schema.user.banExpires,
  createdAt: schema.user.createdAt,
  updatedAt: schema.user.updatedAt,
};

const serializeUser = <
  T extends {
    isAnonymous: boolean | null;
    banExpires: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  row: T
) => ({
  ...row,
  isAnonymous: row.isAnonymous === true,
  banExpires: toISO(row.banExpires),
  createdAt: dayjs(row.createdAt).toISOString(),
  updatedAt: dayjs(row.updatedAt).toISOString(),
});

export const listUsers = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.CreatedAt,
      sortOrder = "desc",
      query,
      role,
      banned,
      anonymous,
    }: ListUsersDTO
  ) => {
    const parsedCursor = parseCursorForOrder(
      cursor ?? null,
      orderBy,
      USER_DATE_ORDER_BY
    );
    // Bound as text: a `Date` in a raw template is serialized in the process's zone and the
    // column is `timestamp` without one, which would shift the cursor by the UTC offset.
    const cursorValue = parsedCursor ? dayjs(parsedCursor).toISOString() : null;
    const search = query?.trim();
    const column = schema.user[orderBy];

    const rawItems = await db
      .select(userColumns)
      .from(schema.user)
      .where(
        and(
          cursorValue
            ? sortOrder === "asc"
              ? sql`${column} >= ${cursorValue}`
              : sql`${column} <= ${cursorValue}`
            : undefined,
          search
            ? or(
                ilike(schema.user.name, `%${search}%`),
                ilike(schema.user.email, `%${search}%`)
              )
            : undefined,
          role ? eq(schema.user.role, role) : undefined,
          banned === undefined ? undefined : eq(schema.user.banned, banned),
          anonymous === undefined
            ? undefined
            : anonymous
              ? eq(schema.user.isAnonymous, true)
              : or(
                  isNull(schema.user.isAnonymous),
                  eq(schema.user.isAnonymous, false)
                )
        )
      )
      .orderBy(sortOrder === "asc" ? asc(column) : desc(column))
      .limit(limit + 1);

    const { items, nextCursor } = sliceNextCursor(
      rawItems,
      limit,
      orderBy,
      USER_DATE_ORDER_BY
    );

    return {
      items: items.map(serializeUser),
      nextCursor,
    };
  }
);

/**
 * The account as the dashboard shows it: profile, linked providers and credential counts.
 * Sessions live in better-auth's secondary storage, not the `session` table, so none are read here.
 */
export const getUserDetail = withDTO(async (db, { id }: { id: string }) => {
  const [row] = await db
    .select({ ...userColumns, emailVerified: schema.user.emailVerified })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1);
  if (!row) return null;

  const [accounts, [passkeys], [apiKeys]] = await Promise.all([
    db
      .select({
        providerId: schema.account.providerId,
        createdAt: schema.account.createdAt,
      })
      .from(schema.account)
      .where(eq(schema.account.userId, id))
      .orderBy(asc(schema.account.createdAt)),
    db
      .select({ total: count() })
      .from(schema.passkey)
      .where(eq(schema.passkey.userId, id)),
    db
      .select({ total: count() })
      .from(schema.apikey)
      .where(eq(schema.apikey.referenceId, id)),
  ]);

  return {
    user: serializeUser(row),
    accounts: accounts.map((account) => ({
      ...account,
      createdAt: dayjs(account.createdAt).toISOString(),
    })),
    passkeys: passkeys?.total ?? 0,
    apiKeys: apiKeys?.total ?? 0,
  };
});

/** Cache life of the overview counts; every `user` write through this process also clears them. */
const STATS_CACHE_SECONDS = 60;

/** Headline counts for the overview. `since` bounds "new"; guests are `is_anonymous` rows. */
export const getUserStats = withDTO(async (db, { since }: { since: Date }) => {
  const guest = eq(schema.user.isAnonymous, true);
  const [row] = await db
    .select({
      total: count(),
      guests: sql<number>`count(*) filter (where ${guest})`.mapWith(Number),
      newSince:
        sql<number>`count(*) filter (where ${gte(schema.user.createdAt, since)})`.mapWith(
          Number
        ),
      banned:
        sql<number>`count(*) filter (where ${eq(schema.user.banned, true)})`.mapWith(
          Number
        ),
    })
    .from(schema.user)
    .$withCache({ config: { ex: STATS_CACHE_SECONDS } });
  return {
    total: row?.total ?? 0,
    guests: row?.guests ?? 0,
    newSince: row?.newSince ?? 0,
    banned: row?.banned ?? 0,
  };
});
