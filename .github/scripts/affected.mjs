import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

// Turbo's graph does not cover these, so a change here selects every workspace.
const CI_SOURCES = [".github/workflows/ci.yml", ".github/scripts"];
const E2E_WORKSPACE = "www-e2e";
// Deploys on Vercel, so its Dockerfile is not a deployment artifact.
const SKIPPED_IMAGES = ["www"];

const base = process.env.TURBO_SCM_BASE;
if (!base) throw new Error("TURBO_SCM_BASE is required");

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" });

const turboVersion = readFileSync("pnpm-workspace.yaml", "utf8").match(
  /^\s+turbo:\s*(\S+)$/m
)?.[1];
if (!turboVersion) throw new Error("turbo is missing from the pnpm catalog");

const ciChanged =
  run("git", [
    "diff",
    "--name-only",
    `${base}...HEAD`,
    "--",
    ...CI_SOURCES,
  ]).trim().length > 0;

const { packages } = JSON.parse(
  run("npx", [
    "--yes",
    `turbo@${turboVersion}`,
    "ls",
    ...(ciChanged ? [] : ["--affected"]),
    "--output=json",
  ])
);

const names = packages.items.map((item) => item.name);
// A Dockerfile that runs `turbo prune` copies the whole monorepo, so it builds from the root.
const deployables = packages.items
  .map((item) => ({ ...item, dockerfile: join(item.path, "Dockerfile") }))
  .filter((item) => existsSync(item.dockerfile))
  .map((item) => ({
    name: item.name,
    path: item.path,
    dockerfile: item.dockerfile,
    context: readFileSync(item.dockerfile, "utf8").includes("turbo prune")
      ? "."
      : item.path,
  }));
const images = deployables.filter(
  (item) => !SKIPPED_IMAGES.includes(item.name)
);

const outputs = {
  all: String(ciChanged),
  any: String(names.length > 0),
  e2e: String(names.includes(E2E_WORKSPACE)),
  images: JSON.stringify(images),
  labels: JSON.stringify({
    labels: deployables.map((item) => `area:${basename(item.path)}`),
  }),
};

for (const [key, value] of Object.entries(outputs)) {
  console.log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}
