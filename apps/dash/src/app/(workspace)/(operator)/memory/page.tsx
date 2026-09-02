import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { MemoryExplorer } from "@/components/memory/memory-explorer";

export const dynamic = "force-dynamic";

const MemoryPage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">Agent Memory</h1>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <MemoryExplorer />
    </Suspense>
  </section>
);

export default MemoryPage;
