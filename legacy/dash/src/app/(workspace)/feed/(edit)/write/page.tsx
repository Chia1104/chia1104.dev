"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

const CreateForm = dynamic(() => import("@/components/feed/create-form"), {
  ssr: false,
});

const Page = () => {
  return (
    <ErrorBoundary>
      <Suspense>
        <CreateForm />
      </Suspense>
    </ErrorBoundary>
  );
};

export default Page;
