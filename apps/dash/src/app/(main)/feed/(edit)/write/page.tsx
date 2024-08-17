import { Suspense } from "react";

import dynamic from "next/dynamic";

import { Features, ErrorBoundary } from "@chia/ui";

import { env } from "@/env";

const CreateForm = dynamic(() => import("./create-form"), {
  ssr: false,
});

const Page = () => {
  return env.NODE_ENV === "production" ? (
    <Features.ComingSoon />
  ) : (
    <ErrorBoundary>
      <Suspense>
        <CreateForm />
      </Suspense>
    </ErrorBoundary>
  );
};

export default Page;
