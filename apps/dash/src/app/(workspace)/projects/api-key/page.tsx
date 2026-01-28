import { ViewTransition } from "react";

import { GlobalApiKeyTable } from "@/components/projects/api-key-table";

const Page = () => {
  return (
    <ViewTransition>
      <section className="flex w-full flex-col gap-4 px-4 py-8 md:px-6 lg:px-8">
        <GlobalApiKeyTable query={{ withProject: true }} />
      </section>
    </ViewTransition>
  );
};

export default Page;
