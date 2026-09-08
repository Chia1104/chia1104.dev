import Link from "next/link";

import DateFormat from "@chia/ui/date-format";
import FadeIn from "@chia/ui/fade-in";
import Image from "@chia/ui/image";

import { FeatureCard } from "@/components/commons/feature-card";

interface Props {
  image: string;
  name: string;
  description?: string;
  tags?: string[];
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
  tags,
  language,
  updatedAt,
  href,
}: Props) => {
  return (
    <FadeIn className="w-full">
      <FeatureCard className="relative flex h-full min-h-[442px] flex-col gap-0 p-0">
        <div className="c-bg-gradient-green-to-purple not-prose relative aspect-video w-full shrink-0 overflow-hidden rounded-t-2xl">
          <Image
            src={image}
            alt={name}
            className="object-cover"
            loading="lazy"
            fill
            sizes="100vw"
          />
        </div>
        <div className="flex flex-1 flex-col p-4 pt-0">
          <h2 className="mt-5 text-lg font-semibold">{name}</h2>
          <span className="text-xs text-gray-500">
            <DateFormat date={updatedAt} format="MMMM D, YYYY" />
          </span>
          <p className="mt-2 line-clamp-2 text-sm">{description}</p>
          <div className="mt-2 flex flex-wrap space-x-2">
            {tags?.map((tag) => (
              <span
                key={tag}
                className="rounded bg-gray-800 px-2 py-1 text-xs font-medium text-white">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap space-x-2">
            {language && (
              <span
                className="rounded bg-gray-800 px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: language.color }}>
                {language.name}
              </span>
            )}
          </div>
        </div>
        <Link href={href} className="absolute inset-0 z-10" />
      </FeatureCard>
    </FadeIn>
  );
};
