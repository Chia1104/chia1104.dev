"use client";

import type { ReactNode } from "react";

import { Tabs, Tab } from "@nextui-org/react";
import { useTransitionRouter } from "next-view-transitions";

const Layout = ({ children }: { children: ReactNode }) => {
  const router = useTransitionRouter();
  return (
    <div className="w-full flex flex-col">
      <Tabs
        variant="underlined"
        className="mb-10"
        onSelectionChange={(e) => router.push(`/feed/${e}`)}>
        <Tab key="posts" title="Posts" className="text-xl" />
        <Tab key="notes" title="Notes" className="text-xl" />
      </Tabs>
      {children}
    </div>
  );
};

export default Layout;
