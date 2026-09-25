"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { Button, Drawer, Spinner } from "@heroui/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "usehooks-ts";

import { DockActions, DockMode, DockShell } from "@chia/ui/dock";
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
  const isOpen = mode !== DockMode.Closed;

  useEffect(() => {
    void useChatDockStore.persist.rehydrate();
  }, []);

  useHotkey("Mod+I", toggle, { enabled: aiEnabled });

  if (!aiEnabled) {
    return null;
  }

  // The drawer and the maximized panel cover the page and its header launcher, so they carry their own close.
  const pageCovered = isOpen && (!isWide || mode === DockMode.Maximized);
  const panelActions = (
    <DockActions
      labels={{
        maximize: t("maximize"),
        restore: t("restore"),
        close: t("close"),
      }}
      mode={mode}
      onModeChange={setMode}
    />
  );
  const compactHeader = pageCovered ? (
    <div className="border-border hidden shrink-0 items-center gap-2 border-b px-4 py-3 sm:flex">
      <span aria-hidden="true" className="flex shrink-0">
        <CHBot className="size-6 rounded-full" resting />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {t("title")}
      </span>
      {isWide ? (
        panelActions
      ) : (
        <Button
          aria-label={t("close")}
          isIconOnly
          onPress={() => setMode(DockMode.Closed)}
          size="sm"
          variant="ghost">
          <span aria-hidden="true" className="i-lucide-x size-4" />
        </Button>
      )}
    </div>
  ) : null;

  return (
    <>
      {isWide ? (
        <DockShell
          className="z-50"
          defaultWidth={DEFAULT_WIDTH}
          label={t("title")}
          mode={mode}
          onModeChange={setMode}
          resizeLabel={t("resize")}
          storageKey="chia.www.chat-dock.width">
          {compactHeader}
          {isOpen ? (
            <PublicChat
              headerActions={pageCovered ? undefined : panelActions}
            />
          ) : null}
        </DockShell>
      ) : (
        <Drawer.Backdrop
          isOpen={isOpen}
          onOpenChange={(open) =>
            setMode(open ? DockMode.Open : DockMode.Closed)
          }>
          <Drawer.Content placement={isSheet ? "bottom" : "right"}>
            <Drawer.Dialog
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden p-0",
                isSheet ? "max-h-[85dvh] pt-4" : "w-full max-w-xl"
              )}>
              {isSheet ? <Drawer.Handle /> : null}
              {compactHeader}
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
