import Card from "@chia/ui/card";

const loadingCards = Array.from({ length: 4 }, (_, card) => `repo-${card}`);

export const ContributionsChartFallback = () => (
  <div className="not-prose my-6 w-full animate-pulse">
    <div className="c-bg-primary h-[130px] w-full rounded-xl" />
    <div className="mt-3 flex items-center justify-between">
      <span className="c-bg-primary h-3 w-24 rounded-full" />
      <span className="c-bg-primary h-3 w-32 rounded-full" />
    </div>
  </div>
);

export const LoadingCard = () => (
  <Card className="relative flex h-full min-h-[442px] flex-col">
    <div className="c-bg-primary not-prose aspect-video w-full shrink-0 animate-pulse overflow-hidden rounded-t-2xl" />
    <div className="flex flex-1 flex-col p-4 pt-0">
      <div className="c-bg-primary mt-5 h-5 w-1/2 animate-pulse rounded-full" />
      <div className="c-bg-primary mt-2 h-4 w-1/4 animate-pulse rounded-full" />
      <div className="c-bg-primary mt-2 h-4 w-1/2 animate-pulse rounded-full" />
      <div className="mt-auto flex flex-wrap space-x-2">
        <span className="c-bg-primary h-4 w-1/4 animate-pulse rounded" />
      </div>
    </div>
  </Card>
);

export const RepoListFallback = () => (
  <div className="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-2">
    {loadingCards.map((card) => (
      <LoadingCard key={card} />
    ))}
  </div>
);

export const ProjectsLoadingFallback = () => (
  <>
    <ContributionsChartFallback />
    <RepoListFallback />
  </>
);
