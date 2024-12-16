import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Blog, WithContext } from "schema-dts";

import FeedContent from "@chia/contents/content";
import { getContentProps } from "@chia/contents/services";
import Image from "@chia/ui/image";
import dayjs from "@chia/utils/day";

import FeedTranslationWarning from "@/components/blog/feed-translation-warning";
import WrittenBy from "@/components/blog/written-by";
import DateFormat from "@/components/commons/date-format";
import { getPosts, getFeedBySlug } from "@/services/feeds.service";
import { I18N } from "@/utils/i18n";
import type { PageParamsWithLocale } from "@/utils/i18n";

export const dynamicParams = true;
export const revalidate = 60;
export const maxDuration = 60;

export const generateStaticParams = async () => {
  const posts = await getPosts(100);

  return posts.items.map((post) => ({
    slug: post.slug,
  }));
};

export const generateMetadata = async ({
  params,
}: {
  params: PageParamsWithLocale<{
    slug: string;
  }>;
}): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const post = await getFeedBySlug(slug);
    if (!post) return {};
    return {
      title: post.title,
      description: post.excerpt,
    };
  } catch (error) {
    console.error(error);
    notFound();
  }
};

const Page = async ({
  params,
}: {
  params: PageParamsWithLocale<{
    slug: string;
  }>;
}) => {
  const { slug, locale } = await params;
  const post = await getFeedBySlug(slug);
  const t = await getTranslations("blog");

  if (!post) {
    notFound();
  }

  const jsonLd: WithContext<Blog> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    headline: post.title,
    datePublished: dayjs(post.createdAt).format("MMMM D, YYYY"),
    dateModified: dayjs(post.updatedAt).format("MMMM D, YYYY"),
    name: post.title,
    description: post.excerpt ?? "",
    author: {
      "@type": "Person",
      name: "Chia1104",
    },
  };

  const props = await getContentProps({
    contentType: post.contentType,
    content: {
      content: post.content?.content,
      source: post.content?.source,
      unstable_serializedSource: post.content?.unstable_serializedSource,
    },
  });

  return (
    <>
      <div className="flex w-full flex-col items-center">
        {locale !== I18N.ZH_TW && <FeedTranslationWarning />}
        <header className="mb-5 w-full self-center mt-5">
          <h1
            style={{
              viewTransitionName: `view-transition-link-${post.id}`,
            }}>
            {post.title}
          </h1>
          <p>{post.description}</p>
          <span className="mt-5 flex items-center gap-2 not-prose">
            <Image
              src="https://avatars.githubusercontent.com/u/38397958?v=4"
              width={40}
              height={40}
              className="rounded-full"
              alt="Chia1104"
            />
            <DateFormat date={post.createdAt} format="MMMM D, YYYY" />
          </span>
        </header>
        <FeedContent
          {...props}
          updatedAt={post.updatedAt}
          tocContents={{
            label: t("otp"),
            updated: t("last-updated"),
          }}
        />
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

export default Page;
