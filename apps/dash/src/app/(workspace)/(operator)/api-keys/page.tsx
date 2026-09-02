import { ViewTransition } from "react";

import { ApiKeyTable } from "@/components/api-keys/api-key-table";

const Page = () => {
  return (
    <ViewTransition>
      <section className="flex w-full flex-col gap-4 px-4 py-8 md:px-6 lg:px-8">
        <ApiKeyTable />
      </section>
    </ViewTransition>
  );
};

export default Page;
