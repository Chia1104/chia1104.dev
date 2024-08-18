"use client";

import type { ReactNode } from "react";

import { Tabs, Tab, Button } from "@nextui-org/react";
import { useTransitionRouter } from "next-view-transitions";
import { useSelectedLayoutSegments } from "next/navigation";

import { setSearchParams } from "@chia/utils";

const Layout = ({ children }: { children: ReactNode }) => {
  const router = useTransitionRouter();
  const segments = useSelectedLayoutSegments();
  console.log(segments);
  return (
    <div className="w-full flex flex-col">
      <header className="flex gap-5 items-center mb-10">
        <Tabs
          variant="underlined"
          selectedKey={segments[0]}
          onSelectionChange={(e) => router.push(`/feed/${e}`)}>
          <Tab key="posts" title="Posts" className="text-xl" />
          <Tab key="notes" title="Notes" className="text-xl" />
          <Tab key="drafts" title="Drafts" className="text-xl" />
        </Tabs>
        <Button
          onPress={() =>
            router.push(
              setSearchParams(
                {
                  token: crypto.randomUUID(),
                },
                {
                  baseUrl: "/feed/write",
                }
              )
            )
          }>
          Create
        </Button>
      </header>
      {children}
    </div>
  );
};

export default Layout;
