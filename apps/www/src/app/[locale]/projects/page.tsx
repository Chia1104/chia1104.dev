import { Suspense } from "react";

import { Band, Panel } from "@/components/commons/ruled";
import { ContributionsChart } from "@/containers/projects/contributions-chart";
import { RepoList } from "@/containers/projects/repo-list";

import {
  ContributionsChartFallback,
  RepoListFallback,
} from "./loading-fallbacks";

export const revalidate = 14400; // 4 hours

const Page = () => {
  return (
    <>
      <Panel>
        <Suspense fallback={<ContributionsChartFallback />}>
          <ContributionsChart />
        </Suspense>
      </Panel>
      <Band />
      <Suspense fallback={<RepoListFallback />}>
        <RepoList />
      </Suspense>
    </>
  );
};

export default Page;
