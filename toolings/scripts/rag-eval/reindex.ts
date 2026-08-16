import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { EMBEDDING_INDEX_VERSION } from "@chia/ai/embeddings/utils";
import {
  FEED_TRANSLATION_SOURCE_TYPE,
  getResourceAdapter,
} from "@chia/api/resources/registry";
import { getConnection } from "@chia/db/client";
import { listFeedTranslationIds } from "@chia/db/repos/feeds";
import {
  deleteResourceChunks,
  listChunksNeedingEmbedding,
  replaceResourceChunks,
  saveChunkEmbeddings,
} from "@chia/db/repos/resources/chunk";

/**
 * Full reindex of an evaluation copy of the corpus, without the workflow
 * runtime: rebuild every resource's chunks through the adapter, then embed
 * whatever lacks a vector for the current `(model, index_version)`.
 *
 * Same repositories the real indexing steps use, so what the eval measures is
 * what production would serve after its own reindex. Kept out of the eval
 * runner on purpose — measuring must never mutate.
 *
 *   pnpm --filter rag-eval reindex db-url=postgresql://…/chia-eval
 *
 * `db-url` is required, and a non-localhost target additionally needs
 * `allow-remote=true` — production reindexes go through the dashboard's
 * `reindex:all`, which records a run; this script records nothing.
 */

const EMBED_BATCH_SIZE = 32;

const options: Record<string, string> = {};
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.split("=");
  if (key && value) {
    options[key] = value;
  }
}

const main = async (): Promise<void> => {
  const url = options["db-url"];
  if (!url) {
    throw new Error(
      "db-url is required — this script refuses implicit targets."
    );
  }
  const host = new URL(url).hostname;
  if (
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    options["allow-remote"] !== "true"
  ) {
    throw new Error(
      `Target host "${host}" is not local. Pass allow-remote=true if you really mean it.`
    );
  }

  const db = await getConnection(url, { withCache: false });
  const provider = resolveEmbeddingProvider();
  console.log(
    `Reindexing ${host} — model ${provider.id} · index ${EMBEDDING_INDEX_VERSION}`
  );

  const ids = await listFeedTranslationIds(db, {});
  const adapter = getResourceAdapter(FEED_TRANSLATION_SOURCE_TYPE);

  let written = 0;
  let unchanged = 0;
  const failed: number[] = [];
  for (const sourceId of ids) {
    const ref = { sourceType: FEED_TRANSLATION_SOURCE_TYPE, sourceId };
    try {
      const chunkSet = await adapter.buildChunks(db, sourceId);
      if (!chunkSet || chunkSet.chunks.length === 0) {
        await deleteResourceChunks(db, { ref });
        continue;
      }
      const result = await replaceResourceChunks(db, {
        ref,
        visibility: chunkSet.visibility,
        chunks: chunkSet.chunks,
      });
      written += result.written;
      unchanged += result.unchanged;
    } catch (error) {
      failed.push(sourceId);
      console.error(`chunking failed for translation ${sourceId}:`, error);
    }
  }
  console.log(
    `chunks: ${written} written, ${unchanged} unchanged, ${failed.length} failed of ${ids.length} translations`
  );

  let embedded = 0;
  // re-query instead of paging one snapshot — every persisted batch shrinks
  // the backlog, so the loop terminates (same invariant as the real step)
  while (true) {
    const batch = await listChunksNeedingEmbedding(db, {
      model: provider.id,
      indexVersion: EMBEDDING_INDEX_VERSION,
      limit: EMBED_BATCH_SIZE,
    });
    if (batch.length === 0) {
      break;
    }
    const vectors = await provider.embed(
      batch.map((chunk) => chunk.content),
      "search_document"
    );
    if (vectors.length !== batch.length) {
      throw new Error(
        `Expected ${batch.length} embeddings, received ${vectors.length}`
      );
    }
    const { savedCount } = await saveChunkEmbeddings(db, {
      model: provider.id,
      indexVersion: EMBEDDING_INDEX_VERSION,
      rows: batch.map((chunk, index) => ({
        chunkId: chunk.id,
        embedding: vectors[index]!,
      })),
    });
    if (savedCount === 0) {
      throw new Error(
        `Persisted no embeddings for ${batch.length} pending chunks — aborting instead of spinning.`
      );
    }
    embedded += savedCount;
    console.log(`embedded ${embedded}…`);
  }

  console.log(`done: ${embedded} vectors embedded`);
  if (failed.length > 0) {
    console.error(`translations that failed chunking: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
};

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
