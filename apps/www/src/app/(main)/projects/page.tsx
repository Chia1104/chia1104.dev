import Link from "next/link";
import { Image, Card } from "@chia/ui";
import { getPinnedRepos } from "@chia/api/github";
import meta from "@chia/meta";
import { type FC } from "react";
import dayjs from "dayjs";

const RepoCard: FC<{
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
}> = ({ image, name, description, tags, language, updatedAt, href }) => {
  const updatedAtText = dayjs(updatedAt).format("MMMM D, YYYY");
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
      <div className="aspect-h-9 aspect-w-16 c-bg-gradient-green-to-purple not-prose w-full overflow-hidden rounded-t-3xl">
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
        <h2 className="mt-5 text-2xl font-bold">{name}</h2>
        <p className="text-sm text-gray-500">{updatedAtText}</p>
        <p className="mt-2 line-clamp-2 text-base">{description}</p>
        <div className="mt-2 flex flex-wrap space-x-2">
          {tags?.map((tag) => (
            <span
              key={tag}
              className="rounded bg-gray-800 px-2 py-1 text-sm font-medium text-white">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap space-x-2">
          {language && (
            <span
              className="rounded bg-gray-800 px-2 py-1 text-sm font-medium text-white"
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

const Page = async () => {
  const repo = await getPinnedRepos(meta.name);
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      {repo.user.pinnedItems.edges.map((item) => (
        <RepoCard
          key={item.node.id}
          href={item.node.url}
          image={item.node.openGraphImageUrl}
          name={item.node.name}
          description={item.node.description}
          language={item.node.primaryLanguage}
          updatedAt={item.node.pushedAt}
        />
      ))}
    </div>
  );
};

export default Page;
