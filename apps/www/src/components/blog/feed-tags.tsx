import { Chip } from "@heroui/react";

import { cn } from "@chia/ui/utils/cn.util";

import { Link } from "@/libs/i18n/navigation";

export interface FeedTagItem {
  id: number;
  slug: string;
  name: string;
}

/** A post's tags as links to their listing; renders nothing for an untagged post. */
export const FeedTags = ({
  className,
  size = "sm",
  tags,
}: {
  className?: string;
  size?: "sm" | "md";
  tags: FeedTagItem[];
}) => {
  if (tags.length === 0) return null;
  return (
    <ul
      className={cn(
        "not-prose m-0 flex list-none flex-wrap gap-1.5 p-0",
        className
      )}
      aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag.id} className="m-0 p-0">
          <Link href={`/tags/${tag.slug}`} className="no-underline">
            <Chip size={size} variant="soft">
              <Chip.Label>{tag.name}</Chip.Label>
            </Chip>
          </Link>
        </li>
      ))}
    </ul>
  );
};
