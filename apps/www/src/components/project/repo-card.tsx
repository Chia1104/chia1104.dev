import Link from "next/link";

import Card from "@chia/ui/card";
import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";

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
    <Card
      className="relative flex h-full min-h-[442px] flex-col"
      wrapperProps={{
        whileInView: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.5,
          },
          offset: 10,
        },
        initial: {
          opacity: 0,
          y: 20,
        },
      }}>
      <div className="aspect-h-9 aspect-w-16 c-bg-gradient-green-to-purple not-prose w-full overflow-hidden rounded-t-2xl">
        <Image
          src={image}
          alt={name}
          className="object-cover"
          loading="lazy"
          fill
          sizes="100vw"
        />
      </div>
      <div className="flex h-full flex-col p-4 pt-0">
        <h2 className="mt-5 text-xl font-bold">{name}</h2>
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
    </Card>
  );
};
