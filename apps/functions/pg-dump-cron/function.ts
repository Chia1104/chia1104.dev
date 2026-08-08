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
const PART_SIZE = 8 * 1024 * 1024;

async function backupPostgres() {
  try {
    console.log(`[${new Date().toISOString()}] Starting Postgres backup...`);

    const timestamp = new Date().valueOf();
    const backupFileName = `${BACKUP_PREFIX}${timestamp}.sql.gz`;

    const s3Client = new Bun.S3Client({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      endpoint: R2_ENDPOINT,
      bucket: R2_BUCKET_NAME,
      region: "auto",
    });

    console.log(`Running pg_dump, streaming to R2: ${backupFileName}`);

    const dump = Bun.spawn(
      [
        "pg_dump",
        "-h",
        PG_HOST,
        "-p",
        PG_PORT,
        "-U",
        PG_USER,
        "-d",
        PG_DATABASE,
      ],
      {
        env: { ...process.env, PGPASSWORD: PG_PASSWORD },
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const gzip = Bun.spawn(["gzip"], {
      stdin: dump.stdout,
      stdout: "pipe",
      stderr: "pipe",
    });

    const writer = s3Client.file(backupFileName).writer({
      retry: 3,
      queueSize: 4,
      partSize: PART_SIZE,
      type: "application/gzip",
    });

    let uploadedBytes = 0;
    let pendingBytes = 0;

    try {
      for await (const chunk of gzip.stdout) {
        writer.write(chunk);
        uploadedBytes += chunk.byteLength;
        pendingBytes += chunk.byteLength;
        if (pendingBytes >= PART_SIZE) {
          await writer.flush();
          pendingBytes = 0;
        }
      }
      const [dumpExitCode, gzipExitCode] = await Promise.all([
        dump.exited,
        gzip.exited,
      ]);

      if (dumpExitCode !== 0) {
        const stderr = await new Response(dump.stderr).text();
        throw new Error(`pg_dump exited with ${dumpExitCode}: ${stderr}`);
      }

      if (gzipExitCode !== 0) {
        const stderr = await new Response(gzip.stderr).text();
        throw new Error(`gzip exited with ${gzipExitCode}: ${stderr}`);
      }

      await writer.end();
    } catch (error) {
      dump.kill();
      gzip.kill();
      const cause = error instanceof Error ? error : new Error(String(error));
      await writer.end(cause);
      throw cause;
    }

    console.log(
      `Backup succeeded: ${backupFileName} (${(uploadedBytes / 1024 / 1024).toFixed(2)} MB)`
    );

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
