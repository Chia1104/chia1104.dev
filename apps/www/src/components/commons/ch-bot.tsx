"use client";

import dynamic from "next/dynamic";

import { Popover } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import useDarkMode from "@chia/ui/utils/use-theme";

import { useSettingsStore } from "@/stores/settings/store";

const Bot = dynamic(() => import("@chia/shaders/bot").then((mod) => mod.Bot), {
  ssr: false,
});

export const CHBot = (
  props: React.ComponentProps<typeof Bot> & {
    wrapperProps?: React.ComponentProps<typeof Popover.Trigger>;
  }
) => {
  const { isDarkMode } = useDarkMode();
  const t = useTranslations("chbot.comming-soon");
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);

  if (!aiEnabled) {
    return null;
  }

  return (
    <Popover>
      <Popover.Trigger {...props.wrapperProps}>
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="inline-block">
          <Bot
            solidColorProps={{ color: isDarkMode ? "#08071a" : "#ffffff" }}
            {...props}
          />
        </motion.div>
      </Popover.Trigger>
      <Popover.Content className="max-w-64">
        <Popover.Dialog>
          <Popover.Arrow />
          <Popover.Heading>{t("title")}</Popover.Heading>
          <p className="text-muted mt-2 text-sm">{t("description")}</p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
};
