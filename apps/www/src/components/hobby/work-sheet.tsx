import { notFound } from "next/navigation";

import { Modal } from "@heroui/react";
import { getLocale } from "next-intl/server";

import type { MediaKind } from "@chia/db/types";

import { MediaDetail, MediaSurface } from "@/components/hobby/media-detail";
import { MediaModal } from "@/components/hobby/media-modal";
import { hobbyFeedsOf, mediaWorkOf } from "@/libs/media.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { MEDIA_KIND_SEGMENT, mediaTitleOf } from "@/shared/media";

/** The same work as its own page, shown over the list the reader came from. */
export const WorkSheet = async ({
  kind,
  slug,
}: {
  kind: MediaKind;
  slug: string;
}) => {
  const [work, articles, locale] = await Promise.all([
    mediaWorkOf(MEDIA_KIND_SEGMENT[kind], slug),
    hobbyFeedsOf({ media: slug }),
    getLocale(),
  ]);
  if (!work) notFound();

  return (
    <MediaModal label={mediaTitleOf(work.entry, dbLocaleResolver(locale))}>
      <MediaDetail
        entry={work.entry}
        achievements={work.achievements}
        articles={articles}
        surface={MediaSurface.Sheet}
        title={(text) => (
          <Modal.Heading className="text-[clamp(2rem,5vw,4.5rem)] leading-[1.05] font-bold tracking-tight text-balance">
            {text}
          </Modal.Heading>
        )}
      />
    </MediaModal>
  );
};
