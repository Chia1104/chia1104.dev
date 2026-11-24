import { and, eq, gt, lte, ne } from "drizzle-orm";

import type { DB } from "../../client.ts";
import { account, session, user } from "../../schemas/schema.ts";
import { transferAgentOwnership } from "../agent/index.ts";

/** What a live session proves about its holder. */
export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  isAnonymous: boolean;
}

export interface SessionRecord {
  session: { id: string; expiresAt: Date };
  user: SessionUser;
}

const sessionUserColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  isAnonymous: user.isAnonymous,
};

const banColumns = {
  id: user.id,
  banned: user.banned,
  banExpires: user.banExpires,
};

export interface BanState {
  id: string;
  banned: boolean;
  banExpires: Date | null;
}

/** A ban without `banExpires` never lifts. */
export const isBanActive = (state: BanState, now = new Date()) =>
  state.banned && (state.banExpires === null || state.banExpires > now);

/** The unexpired session stored under `tokenHash`, or `null`. */
export const findSession = async (
  db: DB,
  tokenHash: string
): Promise<SessionRecord | null> => {
  const [row] = await db
    .select({
      id: session.id,
      expiresAt: session.expiresAt,
      user: sessionUserColumns,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(
      and(eq(session.tokenHash, tokenHash), gt(session.expiresAt, new Date()))
    )
    .limit(1);
  if (!row) return null;
  return { session: { id: row.id, expiresAt: row.expiresAt }, user: row.user };
};

export const createSession = async (
  db: DB,
  input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }
) => {
  await db.insert(session).values(input);
};

export const deleteSession = async (db: DB, tokenHash: string) => {
  await db.delete(session).where(eq(session.tokenHash, tokenHash));
};

/** Nothing reads an expired session, so its row only keeps an address and a user agent. */
export const deleteExpiredSessions = async (db: DB) => {
  await db.delete(session).where(lte(session.expiresAt, new Date()));
};

/** Ends every session of the user but `exceptSessionId`. Returns whether the user exists. */
export const deleteUserSessions = async (
  db: DB,
  userId: string,
  exceptSessionId?: string
) => {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return false;
  await db
    .delete(session)
    .where(
      and(
        eq(session.userId, userId),
        exceptSessionId ? ne(session.id, exceptSessionId) : undefined
      )
    );
  return true;
};

export const createGuestUser = async (db: DB): Promise<string> => {
  const [row] = await db
    .insert(user)
    .values({ name: "Guest", isAnonymous: true })
    .returning({ id: user.id });
  if (!row) throw new Error("Guest insert returned no row");
  return row.id;
};

/** An identity as the OAuth provider vouches for it; `email` is verified and canonical. */
export interface OAuthIdentity {
  providerId: string;
  accountId: string;
  email: string;
  name: string;
  image: string | null;
}

/**
 * The user an OAuth identity signs in as. A linked identity wins; otherwise the verified
 * email attaches it to an existing person, never to a guest, and only then is a user created.
 */
export const resolveOAuthUser = async (
  db: DB,
  identity: OAuthIdentity
): Promise<BanState> =>
  await db.transaction(async (tx) => {
    const [linked] = await tx
      .select(banColumns)
      .from(account)
      .innerJoin(user, eq(user.id, account.userId))
      .where(
        and(
          eq(account.providerId, identity.providerId),
          eq(account.accountId, identity.accountId)
        )
      )
      .limit(1);
    if (linked) return linked;

    const [existing] = await tx
      .select(banColumns)
      .from(user)
      .where(and(eq(user.email, identity.email), eq(user.isAnonymous, false)))
      .limit(1);

    const [target] = existing
      ? [existing]
      : await tx
          .insert(user)
          .values({
            name: identity.name,
            email: identity.email,
            image: identity.image,
          })
          .returning(banColumns);
    if (!target) throw new Error("User insert returned no row");

    await tx.insert(account).values({
      providerId: identity.providerId,
      accountId: identity.accountId,
      userId: target.id,
    });
    return target;
  });

/** Moves a guest's agent work to the person who just signed in, then deletes the guest. */
export const adoptGuest = async (
  db: DB,
  options: { guestId: string; userId: string }
) => {
  const [guest] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, options.guestId), eq(user.isAnonymous, true)))
    .limit(1);
  if (!guest || guest.id === options.userId) return;

  await transferAgentOwnership(db, {
    fromUserId: guest.id,
    toUserId: options.userId,
  });
  await db.delete(user).where(eq(user.id, guest.id));
};

/** Bans and signs the user out everywhere. Returns whether the user exists. */
export const banUser = async (
  db: DB,
  input: { id: string; reason: string | null; expiresAt: Date | null }
) =>
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(user)
      .set({
        banned: true,
        banReason: input.reason,
        banExpires: input.expiresAt,
      })
      .where(eq(user.id, input.id))
      .returning({ id: user.id });
    if (rows.length === 0) return false;
    await tx.delete(session).where(eq(session.userId, input.id));
    return true;
  });

export const unbanUser = async (db: DB, id: string) => {
  const rows = await db
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null })
    .where(eq(user.id, id))
    .returning({ id: user.id });
  return rows.length > 0;
};

/** Deletes the user; sessions, accounts, keys and owned content cascade. */
export const removeUser = async (db: DB, id: string) => {
  const rows = await db
    .delete(user)
    .where(eq(user.id, id))
    .returning({ id: user.id });
  return rows.length > 0;
};

/** A guest has no profile to edit, so their row never matches. */
export const updateUserProfile = async (
  db: DB,
  input: { id: string; name: string; image: string | null }
) => {
  const rows = await db
    .update(user)
    .set({ name: input.name, image: input.image })
    .where(and(eq(user.id, input.id), eq(user.isAnonymous, false)))
    .returning({ id: user.id });
  return rows.length > 0;
};
