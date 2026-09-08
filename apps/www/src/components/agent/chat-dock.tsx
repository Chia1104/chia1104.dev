"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { Button, Drawer, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "usehooks-ts";

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
/** Width the shell reserves; keep it in step with the panel's `w-96`. */
const DOCK_WIDTH = "24rem";

export const ChatDock = () => {
  const t = useTranslations("chbot");
  const aiEnabled = useSettingsStore((state) => state.aiEnabled);
  const isOpen = useChatDockStore((state) => state.isOpen);
  const setOpen = useChatDockStore((state) => state.setOpen);
  const isWide = useMediaQuery(DOCK_QUERY, { initializeWithValue: false });
  const isSheet = useMediaQuery(SHEET_QUERY, { initializeWithValue: false });

  const isDocked = isWide && isOpen;

  useEffect(() => {
    void useChatDockStore.persist.rehydrate();
  }, []);

  /**
   * The shell reserves the dock's width through this variable. It cannot subscribe to the store
   * itself: every page would then hydrate the shell around a value only this branch cares about.
   */
  useEffect(() => {
    if (!isDocked) return;
    const root = document.documentElement;
    root.style.setProperty("--chat-dock-width", DOCK_WIDTH);
    return () => {
      root.style.removeProperty("--chat-dock-width");
    };
  }, [isDocked]);

  if (!aiEnabled) {
    return null;
  }

  return (
    <>
      <Button
        aria-expanded={isOpen}
        aria-label={t("open")}
        className={cn(
          "fixed right-[calc(var(--chat-dock-width,0px)+1.5rem)] bottom-6 z-50 size-16 rounded-full transition-[right] duration-200 ease-out motion-reduce:transition-none",
          // The drawer covers the launcher; the dock leaves it beside the panel as the way back out.
          isOpen && !isDocked ? "invisible" : null
        )}
        onPress={() => setOpen(!isOpen)}>
        <CHBot className="size-16 rounded-full shadow-[0px_0px_15px_4px_rgb(252_165_165/0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252/0.3)]" />
      </Button>

      {isWide ? (
        <aside
          aria-label={t("title")}
          className={cn(
            // `bg-overlay` is the drawer's own surface, so the chat reads the same either way.
            "bg-overlay fixed inset-y-0 right-0 z-50 flex flex-col overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none",
            isOpen ? "border-border w-96 border-l" : "w-0"
          )}>
          <div className="flex h-full w-96 flex-col">
            {isOpen ? <PublicChat /> : null}
          </div>
        </aside>
      ) : (
        <Drawer.Backdrop isOpen={isOpen} onOpenChange={setOpen}>
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
