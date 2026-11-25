import {
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  hashSessionToken,
} from "@chia/auth/session";
import type { DB } from "@chia/db/client";
import type { OAuthIdentity } from "@chia/db/repos/auth";
import {
  adoptGuest,
  createGuestUser,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findSession,
  isBanActive,
  resolveOAuthUser,
  unbanUser,
} from "@chia/db/repos/auth";

/** A new session; `token` goes into the cookie and nowhere else. */
export interface SessionGrant {
  token: string;
  expiresAt: Date;
}

export interface SessionClient {
  ipAddress: string | null;
  userAgent: string | null;
}

export const SignInFailure = {
  /** The provider holds no verified email for the identity. */
  NoVerifiedEmail: "no_verified_email",
  Banned: "banned",
} as const;

export type SignInFailure = (typeof SignInFailure)[keyof typeof SignInFailure];

const issueSession = async (
  db: DB,
  userId: string,
  client: SessionClient
): Promise<SessionGrant> => {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await deleteExpiredSessions(db);
  await createSession(db, {
    tokenHash: await hashSessionToken(token),
    userId,
    expiresAt,
    ...client,
  });
  return { token, expiresAt };
};

/**
 * Every OAuth sign-in ends here. The session the browser held before is replaced: a guest's
 * agent work moves to the person and the guest is deleted; anyone else's session is ended.
 */
export const signInWithOAuth = async (
  db: DB,
  input: {
    identity: OAuthIdentity | null;
    previousToken: string | null;
    client: SessionClient;
  }
): Promise<
  { ok: true; grant: SessionGrant } | { ok: false; reason: SignInFailure }
> => {
  if (!input.identity) {
    return { ok: false, reason: SignInFailure.NoVerifiedEmail };
  }

  const user = await resolveOAuthUser(db, input.identity);
  if (isBanActive(user)) {
    return { ok: false, reason: SignInFailure.Banned };
  }
  if (user.banned) await unbanUser(db, user.id);

  if (input.previousToken) {
    const previousHash = await hashSessionToken(input.previousToken);
    const previous = await findSession(db, previousHash);
    if (previous?.user.isAnonymous) {
      await adoptGuest(db, { guestId: previous.user.id, userId: user.id });
    } else if (previous) {
      await deleteSession(db, previousHash);
    }
  }

  return { ok: true, grant: await issueSession(db, user.id, input.client) };
};

/** A guest session, unless the browser already holds a live session of any kind. */
export const startGuestSession = async (
  db: DB,
  input: { previousToken: string | null; client: SessionClient }
): Promise<SessionGrant | null> => {
  if (
    input.previousToken &&
    (await findSession(db, await hashSessionToken(input.previousToken)))
  ) {
    return null;
  }
  return await issueSession(db, await createGuestUser(db), input.client);
};

export const endSession = async (db: DB, token: string) => {
  await deleteSession(db, await hashSessionToken(token));
};
