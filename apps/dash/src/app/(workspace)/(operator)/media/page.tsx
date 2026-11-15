import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { MediaManager } from "@/components/media/media-manager";

export const dynamic = "force-dynamic";

const MediaPage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">Media log</h1>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <MediaManager />
    </Suspense>
  </section>
);

export default MediaPage;
