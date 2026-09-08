"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { Button, Drawer, Spinner } from "@heroui/react";
import { Bot } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";

import { DockActions, DockShell } from "@chia/ui/dock";

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
const DEFAULT_WIDTH = 416;
/** The sidebar sits inside the page; this keeps the editor beside it usable. */
const PAGE_MIN_WIDTH = 640;
const DOCK_LABELS = {
  maximize: "Maximize the writing agent",
  restore: "Restore the writing agent",
  close: "Close the writing agent",
};

export const AgentDockTrigger = () => {
  const isOpen = useAgentDock((state) => state.mode !== "closed");
  const toggle = useAgentDock((state) => state.toggle);
  return (
    <Button
      aria-expanded={isOpen}
      aria-label="Writing agent"
      isIconOnly
      onPress={toggle}
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
  const mode = useAgentDock((state) => state.mode);
  const setMode = useAgentDock((state) => state.setMode);
  const isDocked = useMediaQuery(DOCK_QUERY, { initializeWithValue: false });
  const isOpen = mode !== "closed";

  useEffect(() => {
    void agentDockStore.persist.rehydrate();
  }, []);

  if (!isDocked) {
    return (
      <Drawer.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => setMode(open ? "open" : "closed")}>
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
      <div className="w-(--dock-width,0px) shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none [html[data-dock-resizing]_&]:transition-none" />
      <DockShell
        defaultWidth={DEFAULT_WIDTH}
        label="Writing agent"
        mode={mode}
        onModeChange={setMode}
        pageMinWidth={PAGE_MIN_WIDTH}
        resizeLabel="Resize the writing agent"
        storageKey="chia.dash.agent-dock.width">
        {isOpen ? (
          <AgentPanel
            headerActions={
              <DockActions
                labels={DOCK_LABELS}
                mode={mode}
                onModeChange={setMode}
              />
            }
          />
        ) : null}
      </DockShell>
    </>
  );
};
