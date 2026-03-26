import { Suspense } from "react";
import { ViewTransition } from "react";

import { Spinner } from "@heroui/react";

import { ManageList } from "@/containers/user/manage-list";

export default function Page() {
  return (
    <ViewTransition>
      <article className="container py-8">
        <Suspense
          fallback={
            <div className="flex w-full items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          }>
          <ManageList />
        </Suspense>
      </article>
    </ViewTransition>
  );
}
