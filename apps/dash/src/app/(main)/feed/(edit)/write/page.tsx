import { Features, ErrorBoundary } from "@chia/ui";

import { env } from "@/env";

import CreateForm from "./create-form";

const Page = () => {
  return env.NODE_ENV === "production" ? (
    <Features.ComingSoon />
  ) : (
    <ErrorBoundary>
      <CreateForm />
    </ErrorBoundary>
  );
};

export default Page;
