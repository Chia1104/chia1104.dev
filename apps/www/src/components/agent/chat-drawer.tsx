"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Drawer, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "usehooks-ts";

import { cn } from "@chia/ui/utils/cn.util";

import { CHBot } from "@/components/commons/ch-bot";
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

export const ChatDrawer = () => {
  const t = useTranslations("chbot");
  const aiEnabled = useSettingsStore((state) => state.aiEnabled);
  const [isOpen, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 640px)", {
    initializeWithValue: false,
  });

  if (!aiEnabled) {
    return null;
  }

  return (
    <Drawer isOpen={isOpen} onOpenChange={setOpen}>
      <Drawer.Trigger
        aria-label={t("open")}
        className={cn(
          "fixed right-6 bottom-6 z-50 size-20 rounded-full",
          isOpen && "invisible"
        )}>
        <CHBot className="size-20 rounded-full shadow-[0px_0px_15px_4px_rgb(252_165_165/0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252/0.3)]" />
      </Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Content placement={isMobile ? "bottom" : "right"}>
          <Drawer.Dialog
            className={cn(
              "flex flex-col",
              isMobile ? "h-[88svh]" : "h-full w-full max-w-xl"
            )}>
            {isMobile ? <Drawer.Handle /> : null}
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>{t("title")}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
              {isOpen ? <PublicChat /> : null}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
};
