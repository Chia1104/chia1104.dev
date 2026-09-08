"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { Button, Drawer, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "usehooks-ts";

import { DockActions, DockShell } from "@chia/ui/dock";
import { cn } from "@chia/ui/utils/cn.util";

import { CHBot } from "@/components/commons/ch-bot";
import { useChatDockStore } from "@/stores/chat-dock/store";
import { useSettingsStore } from "@/stores/settings/store";

/** Streamdown, Shiki and the session store load on the first open, not with every page. */
const PublicChat = dynamic(
  () => import("./public-chat").then((module) => module.PublicChat),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <Spinner aria-label="Loading" size="sm" />
      </div>
    ),
  }
);

/** Wide enough to give up a column; under this the chat opens over the page instead. */
const DOCK_QUERY = "(min-width: 1024px)";
/** Under this a side drawer would leave nothing to read, so the chat comes up as a sheet. */
const SHEET_QUERY = "(max-width: 639px)";
const DEFAULT_WIDTH = 384;

export const ChatDock = () => {
  const t = useTranslations("chbot");
  const aiEnabled = useSettingsStore((state) => state.aiEnabled);
  const mode = useChatDockStore((state) => state.mode);
  const setMode = useChatDockStore((state) => state.setMode);
  const toggle = useChatDockStore((state) => state.toggle);
  const isWide = useMediaQuery(DOCK_QUERY, { initializeWithValue: false });
  const isSheet = useMediaQuery(SHEET_QUERY, { initializeWithValue: false });
  const isOpen = mode !== "closed";

  useEffect(() => {
    void useChatDockStore.persist.rehydrate();
  }, []);

  if (!aiEnabled) {
    return null;
  }

  // The drawer and the maximized panel cover the launcher; the column leaves it as the way back out.
  const launcherCovered = isOpen && (!isWide || mode === "maximized");

  return (
    <>
      <Button
        aria-expanded={isOpen}
        aria-label={t("open")}
        className={cn(
          "fixed right-[calc(var(--dock-width,0px)+1.5rem)] bottom-6 z-50 size-16 rounded-full transition-[right] duration-200 ease-out motion-reduce:transition-none [html[data-dock-resizing]_&]:transition-none",
          launcherCovered ? "invisible" : null
        )}
        onPress={toggle}>
        <CHBot className="size-16 rounded-full shadow-[0px_0px_15px_4px_rgb(252_165_165/0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252/0.3)]" />
      </Button>

      {isWide ? (
        <DockShell
          className="z-50"
          defaultWidth={DEFAULT_WIDTH}
          label={t("title")}
          mode={mode}
          onModeChange={setMode}
          resizeLabel={t("resize")}
          storageKey="chia.www.chat-dock.width">
          {isOpen ? (
            <PublicChat
              headerActions={
                <DockActions
                  labels={{
                    maximize: t("maximize"),
                    restore: t("restore"),
                    close: t("close"),
                  }}
                  mode={mode}
                  onModeChange={setMode}
                />
              }
            />
          ) : null}
        </DockShell>
      ) : (
        <Drawer.Backdrop
          isOpen={isOpen}
          onOpenChange={(open) => setMode(open ? "open" : "closed")}>
          <Drawer.Content placement={isSheet ? "bottom" : "right"}>
            <Drawer.Dialog
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden p-0",
                isSheet ? "max-h-[85dvh] pt-4" : "w-full max-w-xl"
              )}>
              {isSheet ? <Drawer.Handle /> : null}
              <Drawer.Body className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                {isOpen ? <PublicChat /> : null}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      )}
    </>
  );
};
