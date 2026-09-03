import { and, asc, eq, isNull } from "drizzle-orm";

import type { DB } from "../../client.ts";
import { profileEntries } from "../../schemas/schema.ts";
import type { ProfileEntry, ProfileEntryData } from "../../schemas/schema.ts";
import type { ProfileEntryKind } from "../../types.ts";

/** Soft-deleted rows are invisible to every reader here. */
const live = () => isNull(profileEntries.deletedAt);

export interface ListProfileEntriesDTO {
  userId: string;
  kind?: ProfileEntryKind;
  /** Omit for every live row. */
  published?: boolean;
}

/** The whole profile is bounded, so this is unpaginated: kind, then `sortOrder`, then id. */
export const listProfileEntries = async (
  db: DB,
  dto: ListProfileEntriesDTO
): Promise<ProfileEntry[]> =>
  await db
    .select()
    .from(profileEntries)
    .where(
      and(
        live(),
        eq(profileEntries.userId, dto.userId),
        dto.kind ? eq(profileEntries.kind, dto.kind) : undefined,
        dto.published === undefined
          ? undefined
          : eq(profileEntries.published, dto.published)
      )
    )
    .orderBy(
      asc(profileEntries.kind),
      asc(profileEntries.sortOrder),
      asc(profileEntries.id)
    );

export const getProfileEntry = async (
  db: DB,
  id: number
): Promise<ProfileEntry | undefined> =>
  await db.query.profileEntries.findFirst({
    where: { id, deletedAt: { isNull: true } },
  });

export interface InsertProfileEntryDTO {
  userId: string;
  kind: ProfileEntryKind;
  data: ProfileEntryData;
  published?: boolean;
  sortOrder?: number;
}

export const createProfileEntry = async (
  db: DB,
  input: InsertProfileEntryDTO
): Promise<ProfileEntry> => {
  const [row] = await db
    .insert(profileEntries)
    .values({
      userId: input.userId,
      kind: input.kind,
      data: input.data,
      published: input.published ?? false,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  if (!row) throw new Error("Profile entry was not inserted.");
  return row;
};

export interface UpdateProfileEntryDTO {
  kind: ProfileEntryKind;
  data: ProfileEntryData;
  published: boolean;
  sortOrder: number;
}

/** Whole-row replacement: `data` has no partial form. Returns the live row, or undefined. */
export const updateProfileEntry = async (
  db: DB,
  id: number,
  patch: UpdateProfileEntryDTO
): Promise<ProfileEntry | undefined> => {
  const [row] = await db
    .update(profileEntries)
    .set(patch)
    .where(and(eq(profileEntries.id, id), live()))
    .returning();
  return row;
};

export const softDeleteProfileEntry = async (
  db: DB,
  id: number
): Promise<boolean> => {
  const rows = await db
    .update(profileEntries)
    .set({ deletedAt: new Date() })
    .where(and(eq(profileEntries.id, id), live()))
    .returning({ id: profileEntries.id });
  return rows.length > 0;
};
