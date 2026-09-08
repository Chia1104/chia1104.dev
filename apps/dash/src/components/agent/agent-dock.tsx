"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { Button, Drawer, Spinner } from "@heroui/react";
import { Bot } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";

import { cn } from "@chia/ui/utils/cn.util";

import { DrawerPanel } from "@/components/commons/drawer-panel";

import { agentDockStore, useAgentDock } from "./dock-store";

/** The session store, Streamdown and Shiki load on the first open, not with every page. */
const AgentPanel = dynamic(
  () => import("./agent-panel").then((module) => module.AgentPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <Spinner aria-label="Loading" size="sm" />
      </div>
    ),
  }
);

/** Wide enough to give up a column; under this the agent opens over the page instead. */
const DOCK_QUERY = "(min-width: 1280px)";
const DOCK_WIDTH = "w-[26rem]";

export const AgentDockTrigger = () => {
  const isOpen = useAgentDock((state) => state.isOpen);
  const setOpen = useAgentDock((state) => state.setOpen);
  return (
    <Button
      aria-expanded={isOpen}
      aria-label="Writing agent"
      isIconOnly
      onPress={() => setOpen(!isOpen)}
      size="sm"
      variant={isOpen ? "secondary" : "ghost"}>
      <Bot className="size-4" />
    </Button>
  );
};

/**
 * A column beside the page on a wide screen, so the operator keeps editing while the agent works;
 * a drawer over the page on anything narrower.
 */
export const AgentDock = () => {
  const isOpen = useAgentDock((state) => state.isOpen);
  const setOpen = useAgentDock((state) => state.setOpen);
  const isDocked = useMediaQuery(DOCK_QUERY, { initializeWithValue: false });

  useEffect(() => {
    void agentDockStore.persist.rehydrate();
  }, []);

  if (!isDocked) {
    return (
      <Drawer.Backdrop isOpen={isOpen} onOpenChange={setOpen}>
        <DrawerPanel
          className="flex flex-col p-0"
          classNames={{
            handle: "mt-3",
          }}>
          <Drawer.Body className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            {isOpen ? <AgentPanel /> : null}
          </Drawer.Body>
        </DrawerPanel>
      </Drawer.Backdrop>
    );
  }

  return (
    <>
      {/*
       * The row gives up the width and the panel itself is pinned to the viewport, the same split
       * the sidebar uses. An overlay that locks the page's scroll cannot drag a fixed panel with it.
       */}
      <div
        className={cn(
          "shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? DOCK_WIDTH : "w-0"
        )}
      />
      <aside
        aria-label="Writing agent"
        className={cn(
          // `bg-overlay` is the drawer's own surface, so the panel reads the same either way.
          "bg-overlay fixed inset-y-0 right-0 z-20 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? `${DOCK_WIDTH} border-border border-l` : "w-0"
        )}>
        <div className={cn("flex h-full flex-col", DOCK_WIDTH)}>
          {isOpen ? <AgentPanel /> : null}
        </div>
      </aside>
    </>
  );
};
