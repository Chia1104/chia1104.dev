import { Skeleton } from "@heroui/react";

import { Band, Panel, RULED_CELL_CLASS_NAME } from "@/components/commons/ruled";

const loadingCards = Array.from({ length: 4 }, (_, card) => `repo-${card}`);

export const ContributionsChartFallback = () => (
  <div className="flex flex-col gap-3 p-4">
    <Skeleton className="h-[130px] w-full rounded-md" />
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-24 rounded-md" />
      <Skeleton className="h-3 w-32 rounded-md" />
    </div>
  </div>
);

export const RepoListFallback = () => (
  <ul aria-busy="true" className="rule-t rule-b page-md:grid-cols-2 grid">
    {loadingCards.map((card) => (
      <li key={card} className={RULED_CELL_CLASS_NAME}>
        <Skeleton className="aspect-video w-full rounded-none" />
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-5 w-1/2 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
          <Skeleton className="h-3 w-3/4 rounded-md" />
        </div>
      </li>
    ))}
  </ul>
);

export const ProjectsLoadingFallback = () => (
  <>
    <Panel>
      <ContributionsChartFallback />
    </Panel>
    <Band />
    <RepoListFallback />
  </>
);
