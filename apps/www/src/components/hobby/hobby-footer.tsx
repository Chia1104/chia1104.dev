"use client";

import dynamic from "next/dynamic";

import { useTranslations } from "next-intl";

import ThemeSelector from "@chia/ui/theme";
import { Theme } from "@chia/ui/utils/use-theme";

import { Copyright } from "@/components/commons/copyright";
import { LoadingSkeleton } from "@/components/commons/current-playing";
import LocaleSelector from "@/components/commons/locale-selector";
import { Settings } from "@/components/commons/settings";

const CurrentPlaying = dynamic(
  () =>
    import("@/components/commons/current-playing").then(
      (mod) => mod.CurrentPlaying
    ),
  {
    ssr: false,
    loading: () => <LoadingSkeleton />,
  }
);

export const HobbyFooter = () => {
  const t = useTranslations("theme");
  return (
    <footer
      data-testid="footer"
      className="page-md:px-8 mx-auto w-full max-w-6xl px-4 pt-16 pb-10">
      <div className="border-separator page-md:flex-row page-md:items-center page-md:justify-between flex flex-col gap-6 border-t pt-6">
        <div className="flex flex-col gap-3">
          <CurrentPlaying
            experimental={{
              displayBackgroundColorFromImage: true,
            }}
          />
          <Copyright className="text-muted text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeSelector
            enableCMD
            label={t("label")}
            themeLabel={{
              [Theme.System]: t("system"),
              [Theme.Dark]: t("dark"),
              [Theme.Light]: t("light"),
            }}
            buttonProps={{
              variant: "tertiary",
            }}
            dropdownProps={{
              popover: {
                className: "min-w-40",
              },
            }}
          />
          <LocaleSelector />
          <Settings palette={false} />
        </div>
      </div>
    </footer>
  );
};
