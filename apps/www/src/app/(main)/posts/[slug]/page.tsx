import { getAllPosts, getCompiledSource } from "@/helpers/mdx/services";
import { Image, Chip } from "ui";
import { Giscus } from "./components";
import "highlight.js/styles/atom-one-dark-reasonable.css";
import dayjs from "dayjs";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { WithContext, Blog } from "schema-dts";
import { getBaseUrl } from "@/utils/getBaseUrl";

export const generateStaticParams = async () => {
  const posts = await getAllPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
};

// Global not found page
// export const dynamicParams = false;

export const generateMetadata = async ({
  params,
}: {
  params: any;
}): Promise<Metadata> => {
  try {
    const { frontmatter } = await getCompiledSource(params.slug);
    return {
      title: frontmatter?.title,
      keywords: frontmatter?.tags?.join(",") || undefined,
      description: frontmatter?.excerpt,
      openGraph: {
        type: "article",
        locale: "zh_TW",
        url: `https://chia1104.dev/posts/${params.slug}`,
        siteName: "Chia",
        title: frontmatter?.title,
        description: frontmatter?.excerpt,
        images: [
          {
            url: `${getBaseUrl({
              isServer: true,
            })}/api/og?title=${encodeURIComponent(frontmatter?.title ?? "")}`,
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Chia",
        description: frontmatter?.excerpt,
        creator: "@chia1104",
        images: [
          `${getBaseUrl({ isServer: true })}/api/og?title=${encodeURIComponent(
            frontmatter?.title ?? ""
          )}`,
        ],
      },
    };
  } catch (error) {
    console.error(error);
    return {};
  }
};

const PostDetailPage = async ({ params }: { params?: any }) => {
  try {
    const { frontmatter, content } = await getCompiledSource(params.slug);
    const jsonLd: WithContext<Blog> = {
      "@context": "https://schema.org",
      "@type": "Blog",
      headline: frontmatter?.title,
      datePublished: frontmatter?.createdAt,
      dateModified: frontmatter?.updatedAt,
      name: frontmatter?.title,
      description: frontmatter?.excerpt,
      image: `/api/og?title=${encodeURIComponent(frontmatter?.title ?? "")}`,
      keywords: frontmatter?.tags?.join(","),
      author: {
        "@type": "Person",
        name: "Chia1104",
      },
    };

    return (
      <>
        <article className="main c-container mt-10">
          <header className="mb-7 w-full max-w-[900px] self-center pl-3">
            <h1 className="title pb-5">{frontmatter?.title}</h1>
            <p className="c-description">{frontmatter?.excerpt}</p>
            <span className="c-description mt-5 flex items-center gap-2">
              <Image
                src="/memoji/contact-memoji.PNG"
                width={40}
                height={40}
                className="rounded-full"
                alt="Chia1104"
              />
              {dayjs(frontmatter?.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
              {frontmatter?.readingMins}
            </span>
            <Chip data={frontmatter?.tags || []} />
          </header>
          <div className="c-bg-secondary mt-5 w-full max-w-[900px] self-center rounded-xl px-3 py-5 md:p-5">
            {content}
          </div>
          <div className="mx-auto mt-20 w-full max-w-[900px] self-center">
            <Giscus title={frontmatter?.title || ""} />
          </div>
        </article>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </>
    );
  } catch (error) {
    notFound();
  }
};

export default PostDetailPage;
