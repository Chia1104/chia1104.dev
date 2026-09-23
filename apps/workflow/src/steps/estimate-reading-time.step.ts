import "zod/compile";
import { readingTime } from "reading-time-estimator";

import { connectDatabase, invalidateCache } from "@chia/db/client";
import { upsertFeedTranslation } from "@chia/db/repos/feeds";
import { feedTranslations } from "@chia/db/schema";
import { Locale } from "@chia/db/types";
import { logger } from "@chia/observability/logger";

/** The estimator counts CJK by character; without the language it applies English wpm. */
const estimatorLanguage = (locale: Locale) =>
  locale === Locale.zhTW ? ("zh-tw" as const) : ("en" as const);

export const estimateReadingTimeStep = async (
  feedID: number,
  locale: Locale,
  content: string
) => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const readingTimeResult = readingTime(content, {
    language: estimatorLanguage(locale),
  });

  logger.debug(
    { feedID, locale, minutes: readingTimeResult.minutes },
    "Reading time estimated"
  );

  const translation = await upsertFeedTranslation(db, {
    feedId: feedID,
    locale: locale,
    readTime: readingTimeResult.minutes,
  });
  await invalidateCache([feedTranslations]);
  return translation;
};
