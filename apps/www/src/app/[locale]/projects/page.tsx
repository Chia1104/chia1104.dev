import { Suspense, ViewTransition } from "react";

import { getPinnedRepos } from "@chia/api/github";
import meta from "@chia/meta";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import { ErrorFallback } from "@chia/ui/features/Error";

import { RepoCard } from "@/components/project/repo-card";

import { LoadingCard } from "./loading";

export const revalidate = 600;

const RepoList = async () => {
  const repo = await getPinnedRepos(meta.name);
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      {repo.user.pinnedItems.edges.map((item) => (
        <RepoCard
          key={item.node.id}
          href={item.node.url}
          image={item.node.openGraphImageUrl}
          name={item.node.name}
          description={item.node.description}
          language={item.node.primaryLanguage}
          updatedAt={item.node.pushedAt}
        />
      ))}
    </div>
  );
};

const Page = () => {
  return (
    <ViewTransition>
      <ErrorBoundary errorElement={<ErrorFallback />}>
        <Suspense
          fallback={
            <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-2">
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </div>
          }>
          <RepoList />
        </Suspense>
      </ErrorBoundary>
    </ViewTransition>
  );
};

export default Page;
