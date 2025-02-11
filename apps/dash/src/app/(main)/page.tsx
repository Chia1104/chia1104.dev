import { Spacer } from "@heroui/react";

import BrowserOverview from "@/components/chart/browser-overview";
import CountOverview from "@/components/chart/count-overview";

export default function Home() {
  return (
    <article className="c-container main justify-start items-start flex-col gap-5 px-10">
      <h2 className="text-2xl font-bold">Analytics</h2>
      <CountOverview />
      <Spacer y={5} />
      <h2 className="text-2xl font-bold">Insights</h2>
      <BrowserOverview />
    </article>
  );
}
