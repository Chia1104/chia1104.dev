import Link from "next/link";

import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import { cn } from "@chia/ui/utils/cn.util";

import { CELL_LINK_CLASS_NAME, LinkHatch } from "@/components/commons/ruled";

interface Props {
  image: string;
  name: string;
  description?: string;
  language?: {
    name: string;
    color: string;
  };
  updatedAt: string;
  href: string;
}

export const RepoCard = ({
  image,
  name,
  description,
  language,
  updatedAt,
  href,
}: Props) => {
  return (
    <Link
      href={href}
      className={cn(CELL_LINK_CLASS_NAME, "flex h-full flex-col")}>
      <LinkHatch />
      <div className="border-separator bg-default relative aspect-video w-full shrink-0 overflow-hidden border-b">
        <Image
          src={image}
          alt={name}
          className="object-cover"
          loading="lazy"
          fill
          sizes="(min-width: 768px) 384px, 100vw"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h2 className="text-lg leading-snug font-semibold">{name}</h2>
        <span className="text-muted text-xs tabular-nums">
          <DateFormat date={updatedAt} format="MMMM D, YYYY" />
        </span>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
        {language ? (
          <span className="text-muted mt-auto flex items-center gap-1.5 pt-3 text-xs">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: language.color }}
            />
            {language.name}
          </span>
        ) : null}
      </div>
    </Link>
  );
};
