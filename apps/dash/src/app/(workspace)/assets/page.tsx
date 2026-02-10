import { ViewTransition } from "react";

import { FileExplorer } from "@/components/assets/file-explorer";

const Pages = () => {
  return (
    <ViewTransition>
      <section className="flex w-full flex-col gap-4 px-4 py-8 md:px-6 lg:px-8">
        <header className="flex w-full items-center justify-between">
          <h2 className="text-2xl font-bold">Assets</h2>
        </header>
        <FileExplorer />
      </section>
    </ViewTransition>
  );
};

export default Pages;
