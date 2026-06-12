import { execSync } from "child_process";

import type { S3Client } from "bun";

const PG_HOST = Bun.env.PGHOST || "localhost";
const PG_PORT = Bun.env.PGPORT || "5432";
const PG_USER = Bun.env.PGUSER || "postgres";
const PG_PASSWORD = Bun.env.PGPASSWORD || "";
const PG_DATABASE = Bun.env.PGDATABASE || "postgres";

const R2_ENDPOINT = Bun.env.R2_ENDPOINT || "";
const R2_ACCESS_KEY_ID = Bun.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = Bun.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = Bun.env.R2_BUCKET_NAME || "backups";

const BACKUP_PREFIX = "postgres-backup-";
const RETENTION_DAYS = 7;

async function backupPostgres() {
  try {
    console.log(`[${new Date().toISOString()}] Starting Postgres backup...`);

    const timestamp = new Date().valueOf();
    const backupFileName = `${BACKUP_PREFIX}${timestamp}.sql.gz`;

    const pgDumpCmd = `pg_dump -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${PG_DATABASE} | gzip`;

    console.log("Running pg_dump...");

    const backupData = execSync(pgDumpCmd, {
      encoding: "buffer",
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
    });

    console.log(
      `Backup size: ${(backupData.length / 1024 / 1024).toFixed(2)} MB`
    );

    console.log(`Uploading to R2: ${backupFileName}`);

    const s3Client = new Bun.S3Client({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      endpoint: R2_ENDPOINT,
      bucket: R2_BUCKET_NAME,
      region: "auto",
    });

    await s3Client.write(backupFileName, backupData);

    console.log(`Backup succeeded: ${backupFileName}`);

    await cleanupOldBackups(s3Client);

    return { success: true, fileName: backupFileName };
  } catch (error) {
    console.error("Backup failed:", error);
    throw error;
  }
}

async function cleanupOldBackups(s3Client: S3Client) {
  try {
    console.log("Cleaning up old backups...");
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const { contents } = await s3Client.list({ prefix: BACKUP_PREFIX });

    for (const object of contents ?? []) {
      if (!object.key || !object.lastModified) continue;
      if (new Date(object.lastModified) < cutoff) {
        console.log(`Deleting old backup: ${object.key}`);
        await s3Client.delete(object.key);
      }
    }
  } catch (error) {
    console.warn("Failed to clean up old backups (non-fatal):", error);
  }
}

await backupPostgres();
console.log("Backup job completed");
