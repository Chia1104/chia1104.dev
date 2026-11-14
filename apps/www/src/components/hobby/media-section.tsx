import { cn } from "@chia/ui/utils/cn.util";

import { MediaCard } from "@/components/hobby/media-card";
import type { MediaEntry } from "@/shared/media";

export const MediaSectionLayout = {
  /** One row that scrolls sideways; for the overview's shelves. */
  Row: "row",
  /** A wrapping grid that shows comments; for a kind's full log. */
  Wall: "wall",
} as const;

export type MediaSectionLayout =
  (typeof MediaSectionLayout)[keyof typeof MediaSectionLayout];

const LIST_CLASS_NAME = {
  // The padding keeps a favorite's sticker, which overhangs its cover, inside the scroll box.
  [MediaSectionLayout.Row]:
    "-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-3 pb-2 [scrollbar-width:thin] *:w-32 *:shrink-0 *:snap-start page-md:-mx-8 page-md:px-8 page-md:*:w-40",
  [MediaSectionLayout.Wall]:
    "page-sm:grid-cols-3 page-md:grid-cols-4 page-lg:grid-cols-5 grid grid-cols-2 gap-x-4 gap-y-8 pt-3",
} satisfies Record<MediaSectionLayout, string>;

/** A titled group of works. Renders nothing when the group is empty. */
export const MediaSection = ({
  title,
  items,
  layout,
}: {
  title: string;
  items: readonly MediaEntry[];
  layout: MediaSectionLayout;
}) => {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <header className="flex items-baseline gap-3">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <span className="text-muted text-sm tabular-nums">{items.length}</span>
      </header>
      <ul className={cn(LIST_CLASS_NAME[layout])}>
        {items.map((entry) => (
          <li key={entry.id}>
            <MediaCard
              entry={entry}
              detailed={layout === MediaSectionLayout.Wall}
            />
          </li>
        ))}
      </ul>
    </section>
  );
};
