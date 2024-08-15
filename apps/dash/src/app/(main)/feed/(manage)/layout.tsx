"use client";

import type { ReactNode } from "react";

import { Tabs, Tab, Button } from "@nextui-org/react";
import { useTransitionRouter } from "next-view-transitions";

const Layout = ({ children }: { children: ReactNode }) => {
  const router = useTransitionRouter();
  return (
    <div className="w-full flex flex-col">
      <header className="flex gap-5 items-center mb-10">
        <Tabs
          variant="underlined"
          onSelectionChange={(e) => router.push(`/feed/${e}`)}>
          <Tab key="posts" title="Posts" className="text-xl" />
          <Tab key="notes" title="Notes" className="text-xl" />
        </Tabs>
        <Button onPress={() => router.push("/feed/write")}>Create</Button>
      </header>
      {children}
    </div>
  );
};

export default Layout;
