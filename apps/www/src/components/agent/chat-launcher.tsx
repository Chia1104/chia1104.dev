"use client";

import { Button, Kbd, Tooltip, TooltipContent } from "@heroui/react";
import { useTranslations } from "next-intl";

import { DockMode } from "@chia/ui/dock";

import { CHBot } from "@/components/commons/ch-bot";
import { useChatDockStore } from "@/stores/chat-dock/store";
import { useSettingsStore } from "@/stores/settings/store";

/** The header's way into Gloss; it toggles the same dock as Mod+I. */
export const ChatLauncher = () => {
  const t = useTranslations("chbot");
  const aiEnabled = useSettingsStore((state) => state.aiEnabled);
  const isOpen = useChatDockStore((state) => state.mode !== DockMode.Closed);
  const toggle = useChatDockStore((state) => state.toggle);

  if (!aiEnabled) {
    return null;
  }

  const label = t(isOpen ? "collapse" : "open");
  return (
    <Tooltip delay={300}>
      <Button
        aria-expanded={isOpen}
        aria-label={label}
        isIconOnly
        onPress={toggle}
        size="sm"
        variant="ghost">
        <span aria-hidden="true" className="flex">
          <CHBot className="size-5 rounded-full" resting={isOpen} />
        </span>
      </Button>
      <TooltipContent className="flex items-center gap-2">
        {label}
        <Kbd>
          <Kbd.Abbr keyValue="command" />
          <Kbd.Content>I</Kbd.Content>
        </Kbd>
      </TooltipContent>
    </Tooltip>
  );
};
