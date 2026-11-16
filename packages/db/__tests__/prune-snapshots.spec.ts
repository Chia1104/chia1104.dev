import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { pruneSnapshots } from "../prune-snapshots.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

const createMigrations = (names: string[]) => {
  const root = mkdtempSync(join(tmpdir(), "prune-snapshots-"));
  roots.push(root);
  for (const name of names) {
    mkdirSync(join(root, name));
    writeFileSync(join(root, name, "migration.sql"), "");
    writeFileSync(join(root, name, "snapshot.json"), "{}");
  }
  return root;
};

const hasSnapshot = (root: string, name: string) =>
  existsSync(join(root, name, "snapshot.json"));

describe("pruneSnapshots", () => {
  it("keeps the newest snapshots and every migration.sql", () => {
    const names = [
      "20260103000000_c",
      "20260101000000_a",
      "20260104000000_d",
      "20260102000000_b",
    ];
    const root = createMigrations(names);

    expect(pruneSnapshots(root, 2)).toEqual([
      "20260101000000_a",
      "20260102000000_b",
    ]);
    expect(names.filter((name) => hasSnapshot(root, name))).toEqual([
      "20260103000000_c",
      "20260104000000_d",
    ]);
    expect(
      names.every((name) => existsSync(join(root, name, "migration.sql")))
    ).toBe(true);
  });

  it("skips migrations that were already pruned", () => {
    const root = createMigrations([
      "20260101000000_a",
      "20260102000000_b",
      "20260103000000_c",
    ]);
    rmSync(join(root, "20260101000000_a", "snapshot.json"));

    expect(pruneSnapshots(root, 2)).toEqual([]);
    expect(hasSnapshot(root, "20260102000000_b")).toBe(true);
  });

  it("rejects a keep count that would delete the newest snapshot", () => {
    const root = createMigrations(["20260101000000_a"]);

    expect(() => pruneSnapshots(root, 0)).toThrow();
    expect(hasSnapshot(root, "20260101000000_a")).toBe(true);
  });
});
