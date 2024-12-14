import dayjs from "dayjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Blog, WithContext } from "schema-dts";

import FeedContent from "@chia/contents/content";
import { getContentProps } from "@chia/contents/services";
import Image from "@chia/ui/image";

import { getNotes, getNoteBySlug } from "@/services/feeds.service";

import WrittenBy from "../../_components/written-by";

export const generateStaticParams = async () => {
  const notes = await getNotes(100);

  return notes.items.map((note) => ({
    slug: note.slug,
  }));
};
export const dynamicParams = true;
export const revalidate = 60;

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const note = await getNoteBySlug(slug);
    if (!note) notFound();
    return {
      title: note.title,
      description: note.excerpt,
    };
  } catch (error) {
    console.error(error);
    notFound();
  }
};

const PostDetailPage = async ({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) => {
  const { slug } = await params;
  const note = await getNoteBySlug(slug);

  if (!note) {
    notFound();
  }

  const jsonLd: WithContext<Blog> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    headline: note.title,
    datePublished: dayjs(note.createdAt).format("MMMM D, YYYY"),
    dateModified: dayjs(note.updatedAt).format("MMMM D, YYYY"),
    name: note.title,
    description: note.excerpt ?? "",
    author: {
      "@type": "Person",
      name: "Chia1104",
    },
  };

  const props = await getContentProps({
    contentType: note.contentType,
    content: {
      content: note.content?.content,
      source: note.content?.source,
      unstable_serializedSource: note.content?.unstable_serializedSource,
    },
  });

  return (
    <>
      <div className="flex w-full flex-col items-center">
        <header className="mb-14 w-full self-center">
          <h1
            style={{
              viewTransitionName: `view-transition-link-${note.id}`,
            }}>
            {note.title}
          </h1>
          <p>{note.description}</p>
          <span className="mt-5 flex items-center gap-2 not-prose">
            <Image
              src="https://avatars.githubusercontent.com/u/38397958?v=4"
              width={40}
              height={40}
              className="rounded-full"
              alt="Chia1104"
            />
            {dayjs(note.createdAt).format("MMMM D, YYYY")}
          </span>
        </header>
        <FeedContent {...props} updatedAt={note.updatedAt} />
        <WrittenBy
          className="w-full flex justify-start mt-10 relative"
          author="Chia1104"
        />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
};

export default PostDetailPage;
