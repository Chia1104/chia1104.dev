"use client";

import { useTranslations } from "next-intl";

import CurrentPlaying from "@/components/commons/current-playing";

export const FavoriteSongs = () => {
  const t = useTranslations("about.favorite-songs");
  return (
    <>
      <h2>{t("title")}</h2>
      <p>{t("description")}</p>
      <CurrentPlaying
        className="mb-5"
        experimental={{
          displayBackgroundColorFromImage: true,
        }}
      />
    </>
  );
};
