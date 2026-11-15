import { notFound } from "next/navigation";

import { Modal } from "@heroui/react";
import { getLocale } from "next-intl/server";

import { MediaDetail, MediaSurface } from "@/components/hobby/media-detail";
import { MediaModal } from "@/components/hobby/media-modal";
import { mediaWorkOf } from "@/libs/media.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { mediaTitleOf } from "@/shared/media";

/** The same work as its own page, shown over the list the reader came from. */
const Page = async ({ params }: PageProps<"/[locale]/hobby/[kind]/[slug]">) => {
  const { kind, slug } = await params;
  const [work, locale] = await Promise.all([
    mediaWorkOf(kind, slug),
    getLocale(),
  ]);
  if (!work) notFound();

  return (
    <MediaModal label={mediaTitleOf(work.entry, dbLocaleResolver(locale))}>
      <MediaDetail
        entry={work.entry}
        achievements={work.achievements}
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

export default Page;
