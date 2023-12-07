import { Image } from "@chia/ui";
import Giscus from "./giscus";
import dayjs from "dayjs";
import type { Metadata } from "next";
import type { Blog, WithContext } from "schema-dts";
import { getBaseUrl, WWW_BASE_URL } from "@chia/utils";
import { createHmac } from "node:crypto";
import { setSearchParams } from "@chia/utils";
import { env } from "@/env.mjs";
import { getPosts, getPostBySlug } from "@/helpers/services/feeds.service";
import { notFound } from "next/navigation";

export const generateStaticParams = async () => {
  const posts = await getPosts(100);

  return posts.items.map((post) => ({
    slug: post.slug,
  }));
};
export const dynamicParams = true;
export const revalidate = 60;

const getToken = (id: string): string => {
  const hmac = createHmac("sha256", env.SHA_256_HASH ?? "super secret");
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
    const token = getToken(post[0].title);
    return {
      title: post[0].title,
      description: post[0]?.expert,
      openGraph: {
        type: "article",
        locale: "zh_TW",
        url: `https://chia1104.dev/posts/${params.slug}`,
        siteName: "Chia",
        title: post[0]?.title,
        description: post[0]?.expert ?? "",
        images: [
          {
            url: setSearchParams(
              {
                title: post[0]?.title,
                excerpt: post[0].expert,
                subtitle: dayjs(post[0].updatedAt).format("MMMM D, YYYY"),
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
        description: post[0]?.expert ?? "",
        creator: "@chia1104",
        images: [
          setSearchParams(
            {
              title: post[0]?.title,
              excerpt: post[0].expert,
              subtitle: dayjs(post[0].updatedAt).format("MMMM D, YYYY"),
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

  if (!post?.[0]) {
    notFound();
  }

  const token = getToken(post[0].slug);
  const jsonLd: WithContext<Blog> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    headline: post[0].title,
    datePublished: dayjs(post[0]?.createdAt).format("MMMM D, YYYY"),
    dateModified: dayjs(post[0]?.updatedAt).format("MMMM D, YYYY"),
    name: post[0]?.title,
    description: post[0]?.expert ?? "",
    image: `/api/og?${setSearchParams({
      title: post[0].title,
      excerpt: post[0].expert,
      subtitle: dayjs(post[0].updatedAt).format("MMMM D, YYYY"),
      token: token,
    })}`,
    author: {
      "@type": "Person",
      name: "Chia1104",
    },
  };

  return (
    <>
      <article className="main c-container mt-20">
        <header className="mb-7 w-full max-w-[900px] self-center pl-3">
          <h1 className="title pb-5">{post[0]?.title}</h1>
          <p className="c-description">{post[0]?.description}</p>
          <span className="c-description mt-5 flex items-center gap-2">
            <Image
              src="https://avatars.githubusercontent.com/u/38397958?v=4"
              width={40}
              height={40}
              className="rounded-full"
              alt="Chia1104"
            />
            {dayjs(post[0]?.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
          </span>
        </header>
        <div className="mx-auto mt-20 w-full max-w-[900px] self-center">
          <Giscus title={post[0]?.title || ""} />
        </div>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
};

export default PostDetailPage;
