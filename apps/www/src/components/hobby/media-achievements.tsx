import Image from "next/image";

import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { cn } from "@chia/ui/utils/cn.util";

import { dbLocaleResolver } from "@/libs/utils/i18n";
import {
  AchievementRarity,
  achievementRarityOf,
  arrangeAchievements,
} from "@/shared/media";
import type { MediaAchievement } from "@/shared/media";

/** How many achievements stand in the open; the rest wait behind a disclosure. */
const PREVIEW_COUNT = 12;
/** Steam serves its icons at 64px; drawn larger they blur. */
const ICON_SIZE = 44;

/** The frame an unlocked achievement's icon wears; the rarer, the louder. */
const RARITY_FRAME = {
  [AchievementRarity.Rare]:
    "ring-accent ring-2 shadow-[0_0_0.875rem_-0.125rem_var(--accent)]",
  [AchievementRarity.Uncommon]: "ring-accent/50 ring-1",
  [AchievementRarity.Common]: undefined,
} as const satisfies Record<AchievementRarity, string | undefined>;

const GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-x-8 gap-y-5";

/**
 * A game's achievements as Steam defines them: icon, what it takes, how many players hold it and
 * when the owner got it. Icons load from Steam's CDN as they are, so nothing resizes them.
 */
export const MediaAchievements = async ({
  achievements,
}: {
  achievements: MediaAchievement[];
}) => {
  const [locale, t, format] = await Promise.all([
    getLocale(),
    getTranslations("hobby.detail"),
    getFormatter(),
  ]);
  const dbLocale = dbLocaleResolver(locale);
  const { listed, hiddenLocked } = arrangeAchievements(achievements);

  const row = (item: MediaAchievement) => {
    const text =
      item.translations[dbLocale] ??
      Object.values(item.translations).find((translation) => translation);
    const rarity = achievementRarityOf(item.globalPercent);
    const rare = rarity === AchievementRarity.Rare;
    const facts = [
      rare ? t("achievement-rare") : null,
      item.globalPercent === null
        ? null
        : t("achievement-share", {
            share: format.number(item.globalPercent / 100, {
              style: "percent",
              maximumFractionDigits: 1,
            }),
          }),
      item.unlockedAt
        ? t("achievement-unlocked-on", {
            date: format.dateTime(item.unlockedAt, { dateStyle: "medium" }),
          })
        : t(item.unlocked ? "achievement-unlocked" : "achievement-locked"),
    ].filter((fact) => fact !== null);

    return (
      <li
        key={item.apiName}
        className={cn(
          "flex items-start gap-3",
          !item.unlocked && "opacity-60"
        )}>
        <Image
          src={item.unlocked ? item.iconUrl : item.lockedIconUrl}
          alt=""
          width={ICON_SIZE}
          height={ICON_SIZE}
          unoptimized
          referrerPolicy="no-referrer"
          className={cn(
            "shrink-0 rounded-sm",
            item.unlocked ? RARITY_FRAME[rarity] : undefined
          )}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm leading-snug font-semibold">{text?.name}</p>
          {text?.description ? (
            <p className="text-muted line-clamp-2 text-xs leading-snug">
              {text.description}
            </p>
          ) : null}
          <p
            className={cn(
              "text-xs tabular-nums",
              rare && item.unlocked ? "text-accent font-medium" : "text-muted"
            )}>
            {facts.join(" · ")}
          </p>
        </div>
      </li>
    );
  };

  const preview = listed.slice(0, PREVIEW_COUNT);
  const rest = listed.slice(PREVIEW_COUNT);

  return (
    <div className="flex flex-col gap-5">
      {preview.length > 0 ? (
        <ul aria-label={t("achievements")} className={GRID}>
          {preview.map(row)}
        </ul>
      ) : null}
      {rest.length > 0 ? (
        <details>
          <summary className="link w-fit cursor-pointer text-sm">
            {t("achievements-more", { count: rest.length })}
          </summary>
          <ul className={cn(GRID, "mt-5")}>{rest.map(row)}</ul>
        </details>
      ) : null}
      {hiddenLocked > 0 ? (
        <p className="text-muted text-sm">
          {t("achievements-hidden", { count: hiddenLocked })}
        </p>
      ) : null}
    </div>
  );
};
