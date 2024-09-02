import { Suspense } from "react";

import dayjs from "dayjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createHmac } from "node:crypto";
import type { Blog, WithContext } from "schema-dts";

import { Content, ContentProvider } from "@chia/contents/content";
import { getContentProps } from "@chia/contents/services";
import { Image } from "@chia/ui";
import { WWW_BASE_URL } from "@chia/utils";
import { setSearchParams } from "@chia/utils";

import { ContentSkeletons } from "@/app/(blog)/notes/[slug]/loading";
import type { OgDTO } from "@/app/api/(v1)/og/utils";
import { env } from "@/env";
import { getNotes, getNoteBySlug } from "@/services/feeds.service";

export const generateStaticParams = async () => {
  const notes = await getNotes(100);

  return notes.items.map((note) => ({
    slug: note.slug,
  }));
};
export const dynamicParams = true;
export const revalidate = 60;

const getToken = (id: string): string => {
  const hmac = createHmac("sha256", env.SHA_256_HASH);
  hmac.update(JSON.stringify({ title: id }));
  return hmac.digest("hex");
};

export const generateMetadata = async ({
  params,
}: {
  params: {
    slug: string;
  };
}): Promise<Metadata> => {
  try {
    const note = await getNoteBySlug(params.slug);
    if (!note) notFound();
    const token = getToken(note.title);
    return {
      title: note.title,
      description: note.excerpt,
      openGraph: {
        type: "article",
        locale: "zh_TW",
        url: `https://chia1104.dev/notes/${note.slug}`,
        siteName: "Chia",
        title: note.title,
        description: note.excerpt ?? "",
        images: [
          {
            url: setSearchParams<OgDTO>(
              {
                title: note.title,
                excerpt: note.excerpt,
                subtitle: dayjs(note.updatedAt).format("MMMM D, YYYY"),
                token: token,
              },
              {
                baseUrl: `${WWW_BASE_URL}/api/og`,
              }
            ),
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Chia",
        description: note.excerpt ?? "",
        creator: "@chia1104",
        images: [
          setSearchParams<OgDTO>(
            {
              title: note.title,
              excerpt: note.excerpt,
              subtitle: dayjs(note.updatedAt).format("MMMM D, YYYY"),
              token: token,
            },
            {
              baseUrl: `${WWW_BASE_URL}/api/og`,
            }
          ),
        ],
      },
    };
  } catch (error) {
    console.error(error);
    notFound();
  }
};

const PostDetailPage = async ({
  params,
}: {
  params: {
    slug: string;
  };
}) => {
  const note = await getNoteBySlug(params.slug);

  if (!note) {
    notFound();
  }

  const token = getToken(note.slug);
  const jsonLd: WithContext<Blog> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    headline: note.title,
    datePublished: dayjs(note.createdAt).format("MMMM D, YYYY"),
    dateModified: dayjs(note.updatedAt).format("MMMM D, YYYY"),
    name: note.title,
    description: note.excerpt ?? "",
    image: `/api/og?${setSearchParams<OgDTO>({
      title: note.title,
      excerpt: note.excerpt,
      subtitle: dayjs(note.updatedAt).format("MMMM D, YYYY"),
      token: token,
    })}`,
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
        <Suspense
          fallback={
            <div className="flex flex-col items-center">
              <ContentSkeletons />
            </div>
          }>
          <ContentProvider {...props}>
            <Content updatedAt={note.updatedAt} {...props} />
          </ContentProvider>
        </Suspense>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
};

export default PostDetailPage;
