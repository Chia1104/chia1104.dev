import { Image } from "@chia/ui";
import dayjs from "dayjs";
import type { Metadata } from "next";
import type { Blog, WithContext } from "schema-dts";
import { getBaseUrl, WWW_BASE_URL } from "@chia/utils";
import { createHmac } from "node:crypto";
import { setSearchParams } from "@chia/utils";
import { env } from "@/env";
import { getPosts, getPostBySlug } from "@/services/feeds.service";
import { notFound } from "next/navigation";
import type { OgDTO } from "@/app/api/(v1)/og/utils";
import Content from "./content";
import { Suspense } from "react";

/**
 * TODO: waiting for the next release of fumadocs-ui (v13)
 */
// import "fumadocs-ui/style.css";

export const generateStaticParams = async () => {
  const posts = await getPosts(100);

  return posts.items.map((post) => ({
    slug: post.slug,
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
    const post = await getPostBySlug(params.slug);
    if (!post) return {};
    const token = getToken(post.title);
    return {
      title: post.title,
      description: post.excerpt,
      openGraph: {
        type: "article",
        locale: "zh_TW",
        url: `https://chia1104.dev/posts/${post.slug}`,
        siteName: "Chia",
        title: post.title,
        description: post.excerpt ?? "",
        images: [
          {
            url: setSearchParams<OgDTO>(
              {
                title: post.title,
                excerpt: post.excerpt,
                subtitle: dayjs(post.updatedAt).format("MMMM D, YYYY"),
                token: token,
              },
              {
                baseUrl: `${getBaseUrl({
                  isServer: true,
                  baseUrl: WWW_BASE_URL,
                })}/api/og`,
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
        description: post.excerpt ?? "",
        creator: "@chia1104",
        images: [
          setSearchParams<OgDTO>(
            {
              title: post.title,
              excerpt: post.excerpt,
              subtitle: dayjs(post.updatedAt).format("MMMM D, YYYY"),
              token: token,
            },
            {
              baseUrl: `${getBaseUrl({
                isServer: true,
                baseUrl: WWW_BASE_URL,
              })}/api/og`,
            }
          ),
        ],
      },
    };
  } catch (error) {
    console.error(error);
    return {};
  }
};

const PostDetailPage = async ({
  params,
}: {
  params: {
    slug: string;
  };
}) => {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const token = getToken(post.slug);
  const jsonLd: WithContext<Blog> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    headline: post.title,
    datePublished: dayjs(post.createdAt).format("MMMM D, YYYY"),
    dateModified: dayjs(post.updatedAt).format("MMMM D, YYYY"),
    name: post.title,
    description: post.excerpt ?? "",
    image: `/api/og?${setSearchParams<OgDTO>({
      title: post.title,
      excerpt: post.excerpt,
      subtitle: dayjs(post.updatedAt).format("MMMM D, YYYY"),
      token: token,
    })}`,
    author: {
      "@type": "Person",
      name: "Chia1104",
    },
  };

  return (
    <>
      <div className="flex w-full flex-col items-center">
        <header className="mb-7 w-full self-center pl-3">
          <h1 className="">{post.title}</h1>
          <p className="">{post.description}</p>
          <span className="mt-5 flex items-center gap-2">
            <Image
              src="https://avatars.githubusercontent.com/u/38397958?v=4"
              width={40}
              height={40}
              className="rounded-full"
              alt="Chia1104"
            />
            {dayjs(post.createdAt).format("MMMM D, YYYY")}
          </span>
        </header>
        <Suspense
          fallback={
            <div className="loader mb-4 size-12 rounded-full border-4 border-gray-200 ease-linear" />
          }>
          <Content type={post.post?.type} content={post.post?.content ?? ""} />
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
