import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { TagsManager } from "@/components/tags/tags-manager";

export const dynamic = "force-dynamic";

const TagsPage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">Tags</h1>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <TagsManager />
    </Suspense>
  </section>
);

export default TagsPage;
