"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { Button, Drawer, Spinner, Tooltip } from "@heroui/react";
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
  const docked = isOpen && !launcherCovered;
  const launcherLabel = t(isOpen ? "collapse" : "open");
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
  const compactHeader = launcherCovered ? (
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
          onPress={() => setMode("closed")}
          size="sm"
          variant="ghost">
          <span aria-hidden="true" className="i-lucide-x size-4" />
        </Button>
      )}
    </div>
  ) : null;

  return (
    <>
      <div
        className={cn(
          "fixed bottom-6 z-60 grid size-16 place-items-center transition-[right] duration-200 ease-out motion-reduce:transition-none [html[data-dock-resizing]_&]:transition-none",
          docked
            ? "right-[calc(var(--dock-width,0px)-2rem)]"
            : "right-[calc(var(--dock-width,0px)+1.5rem)]",
          launcherCovered ? "invisible" : null
        )}
        data-docked={docked}>
        <span
          aria-hidden="true"
          className={cn(
            "border-border bg-background pointer-events-none absolute inset-1 rounded-full border transition-[opacity,transform] duration-200 ease-out [clip-path:inset(0_0_0_50%)] motion-reduce:transition-none",
            docked ? "scale-100 opacity-100" : "scale-70 opacity-0"
          )}
        />
        <Tooltip delay={300} isDisabled={launcherCovered}>
          <Button
            aria-expanded={isOpen}
            aria-label={launcherLabel}
            className={cn(
              "group/chbot focus-visible:outline-focus relative min-w-0 overflow-visible rounded-full bg-transparent p-0 transition-[width,height] duration-200 ease-out hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-3 data-[hovered=true]:bg-transparent data-[pressed=true]:bg-transparent motion-reduce:transition-none",
              docked ? "size-12" : "size-16"
            )}
            isIconOnly
            onPress={toggle}
            variant="ghost">
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute flex size-16 rounded-full transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none",
                docked
                  ? "scale-[0.625] shadow-none"
                  : "shadow-[0_0_15px_4px_rgb(252_165_165/0.3)] dark:shadow-[0_0_15px_4px_rgb(192_132_252/0.3)]"
              )}>
              <CHBot className="size-16 rounded-full" resting={docked} />
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "bg-overlay/85 text-foreground pointer-events-none absolute grid size-10 place-items-center rounded-full opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none",
                docked
                  ? "group-hover/chbot:opacity-100 group-focus-visible/chbot:opacity-100 group-data-[focus-visible=true]/chbot:opacity-100"
                  : null
              )}>
              <span className="i-lucide-chevron-right size-5" />
            </span>
          </Button>
          <Tooltip.Content placement="left">{launcherLabel}</Tooltip.Content>
        </Tooltip>
      </div>

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
              headerActions={launcherCovered ? undefined : panelActions}
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
