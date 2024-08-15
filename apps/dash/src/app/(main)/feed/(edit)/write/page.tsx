import { Features, ErrorBoundary } from "@chia/ui";

import { env } from "@/env";

import CreateTest from "./create-test";

const Page = () => {
  return env.NODE_ENV === "production" ? (
    Features.ComingSoon
  ) : (
    <ErrorBoundary>
      <CreateTest />
    </ErrorBoundary>
  );
};

export default Page;
