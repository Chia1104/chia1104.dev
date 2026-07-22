import { desc, eq } from "drizzle-orm";

import type { DB } from "../..";
import { schema } from "../..";
import type { SpotifyCredential } from "../../schemas/spotify.schema";

export interface UpsertSpotifyCredentialDTO {
  userId: string;
  spotifyUserId: string;
  spotifyDisplayName?: string | null;
  spotifyImageUrl?: string | null;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  scope: string;
}

export const upsertSpotifyCredential = async (
  db: DB,
  dto: UpsertSpotifyCredentialDTO
) => {
  const [credential] = await db
    .insert(schema.spotifyCredential)
    .values(dto)
    .onConflictDoUpdate({
      target: schema.spotifyCredential.userId,
      set: {
        spotifyUserId: dto.spotifyUserId,
        spotifyDisplayName: dto.spotifyDisplayName,
        spotifyImageUrl: dto.spotifyImageUrl,
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        accessTokenExpiresAt: dto.accessTokenExpiresAt,
        scope: dto.scope,
        updatedAt: new Date(),
      },
    })
    .returning();

  return credential;
};

export const getSpotifyCredentialByUserId = async (db: DB, userId: string) => {
  return db.query.spotifyCredential.findFirst({
    where: {
      userId,
    },
  });
};

export const getActiveSpotifyCredential = async (db: DB) => {
  return db.query.spotifyCredential.findFirst({
    where: {
      isActive: true,
    },
  });
};

export const listSpotifyCredentials = async (db: DB) => {
  return db
    .select({
      userId: schema.spotifyCredential.userId,
      adminName: schema.user.name,
      adminImage: schema.user.image,
      spotifyUserId: schema.spotifyCredential.spotifyUserId,
      spotifyDisplayName: schema.spotifyCredential.spotifyDisplayName,
      spotifyImageUrl: schema.spotifyCredential.spotifyImageUrl,
      accessTokenExpiresAt: schema.spotifyCredential.accessTokenExpiresAt,
      scope: schema.spotifyCredential.scope,
      isActive: schema.spotifyCredential.isActive,
      createdAt: schema.spotifyCredential.createdAt,
      updatedAt: schema.spotifyCredential.updatedAt,
    })
    .from(schema.spotifyCredential)
    .innerJoin(schema.user, eq(schema.spotifyCredential.userId, schema.user.id))
    .orderBy(desc(schema.spotifyCredential.updatedAt));
};

export const setActiveSpotifyCredential = async (db: DB, userId: string) => {
  return db.transaction(async (trx) => {
    const credential = await trx.query.spotifyCredential.findFirst({
      columns: {
        userId: true,
      },
      where: {
        userId,
      },
    });

    if (!credential) {
      return undefined;
    }

    await trx
      .update(schema.spotifyCredential)
      .set({ isActive: false })
      .where(eq(schema.spotifyCredential.isActive, true));

    const [activeCredential] = await trx
      .update(schema.spotifyCredential)
      .set({ isActive: true })
      .where(eq(schema.spotifyCredential.userId, userId))
      .returning();

    return activeCredential;
  });
};

export const withLockedSpotifyCredential = async <T>(
  db: DB,
  userId: string,
  handler: (
    credential: SpotifyCredential,
    updateTokens: (dto: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: Date;
      scope: string;
    }) => Promise<void>
  ) => Promise<T>
) => {
  return db.transaction(async (trx) => {
    const [credential] = await trx
      .select()
      .from(schema.spotifyCredential)
      .where(eq(schema.spotifyCredential.userId, userId))
      .for("update")
      .limit(1);

    if (!credential) {
      return undefined;
    }

    return handler(credential, async (dto) => {
      await trx
        .update(schema.spotifyCredential)
        .set({
          ...dto,
          updatedAt: new Date(),
        })
        .where(eq(schema.spotifyCredential.userId, credential.userId));
    });
  });
};

export const deleteSpotifyCredential = async (db: DB, userId: string) => {
  const [credential] = await db
    .delete(schema.spotifyCredential)
    .where(eq(schema.spotifyCredential.userId, userId))
    .returning({
      userId: schema.spotifyCredential.userId,
      wasActive: schema.spotifyCredential.isActive,
    });

  return credential;
};
