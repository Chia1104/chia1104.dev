import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { RagChunkExplorer } from "@/components/rag/rag-chunk-explorer";

export const dynamic = "force-dynamic";

const RagChunksPage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">Chunks</h1>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <RagChunkExplorer />
    </Suspense>
  </section>
);

export default RagChunksPage;
