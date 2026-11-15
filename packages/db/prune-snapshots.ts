import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * drizzle-kit diffs the schema against the newest snapshot and settles two
 * branches from the snapshot they forked at; migrations run from
 * `migration.sql` alone. The count must reach back past the fork point of any
 * unmerged branch, or `drizzle-kit check` diffs that branch against an empty
 * schema and reports a conflict.
 */
export const KEEP_SNAPSHOTS = 10;

/** Deletes every `snapshot.json` except the newest `keep` and returns the migrations it pruned. */
export const pruneSnapshots = (
  migrationsFolder: string,
  keep = KEEP_SNAPSHOTS
) => {
  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error("keep must be a positive integer");
  }

  const migrations = readdirSync(migrationsFolder)
    .filter((name) => existsSync(join(migrationsFolder, name, "snapshot.json")))
    .toSorted();
  const pruned = migrations.slice(0, Math.max(0, migrations.length - keep));

  for (const name of pruned) {
    rmSync(join(migrationsFolder, name, "snapshot.json"));
  }
  return pruned;
};

if (import.meta.main) {
  const pruned = pruneSnapshots(
    join(import.meta.dirname, ".drizzle/migrations")
  );
  console.log(`Pruned ${pruned.length} migration snapshot(s)`);
}
