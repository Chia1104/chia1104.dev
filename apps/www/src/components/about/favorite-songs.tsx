"use client";

import { useTranslations } from "next-intl";

import { CurrentPlaying } from "@/components/commons/current-playing";
import {
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/commons/ruled";

export const FavoriteSongs = () => {
  const t = useTranslations("about.favorite-songs");
  return (
    <>
      <PanelHeader>
        <PanelTitle>{t("title")}</PanelTitle>
        <PanelDescription>{t("description")}</PanelDescription>
      </PanelHeader>
      <PanelBody>
        <CurrentPlaying
          experimental={{
            displayBackgroundColorFromImage: true,
          }}
        />
      </PanelBody>
    </>
  );
};
