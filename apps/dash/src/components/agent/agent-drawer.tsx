"use client";

import dynamic from "next/dynamic";

import { Button, Drawer, Spinner } from "@heroui/react";
import { Bot } from "lucide-react";
import { useQueryState } from "nuqs";

import { DrawerPanel } from "@/components/commons/drawer-panel";

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

/** `?agent` keeps the drawer open across navigation, so a jump to the editor does not close it. */
const useAgentOpen = () => {
  const [value, setValue] = useQueryState("agent");
  return [
    value !== null,
    (open: boolean) => void setValue(open ? "open" : null),
  ] as const;
};

export const AgentDrawerTrigger = () => {
  const [open, setOpen] = useAgentOpen();
  return (
    <Button
      aria-label="Writing agent"
      isIconOnly
      onPress={() => setOpen(!open)}
      size="sm"
      variant={open ? "secondary" : "ghost"}>
      <Bot className="size-4" />
    </Button>
  );
};

export const AgentDrawer = () => {
  const [open, setOpen] = useAgentOpen();
  return (
    <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
      <DrawerPanel className="flex flex-col p-0">
        <Drawer.Body className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {open ? <AgentPanel /> : null}
        </Drawer.Body>
      </DrawerPanel>
    </Drawer.Backdrop>
  );
};
