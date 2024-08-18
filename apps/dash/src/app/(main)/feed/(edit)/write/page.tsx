import { Suspense } from "react";

import dynamic from "next/dynamic";

import { ErrorBoundary } from "@chia/ui";

const CreateForm = dynamic(() => import("./create-form"), {
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
