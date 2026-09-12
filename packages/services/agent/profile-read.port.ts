import type { ProfileReadPort } from "@chia/agent-content/types";
import type { DB } from "@chia/db/client";
import { listProfileEntries } from "@chia/db/repos/profile";
import { profileEntryContentSchema } from "@chia/db/validator/profile";

/**
 * Published rows of the configured author, in the site's order. Visibility is fixed here;
 * nothing downstream can ask for a draft.
 */

export interface CreateProfileReadPortOptions {
  db: DB;
  authorId: string;
}

export const createProfileReadPort = (
  options: CreateProfileReadPortOptions
): ProfileReadPort => ({
  async listPublished() {
    const rows = await listProfileEntries(options.db, {
      userId: options.authorId,
      published: true,
    });
    // re-pairs kind with data: a stored row that drifted from its kind fails here, not in the prompt
    return rows.map((row) =>
      profileEntryContentSchema.parse({ kind: row.kind, data: row.data })
    );
  },
});
