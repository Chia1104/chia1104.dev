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
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-(--hobby-gutter) pt-[clamp(4rem,10vw,8rem)] pb-20">
      <div className="flex flex-wrap items-center gap-4">
        <Copyright className="text-muted text-sm" />
        <CurrentPlaying
          experimental={{
            displayBackgroundColorFromImage: true,
          }}
        />
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
    </footer>
  );
};
