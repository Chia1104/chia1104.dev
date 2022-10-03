import dayjs from "dayjs";
import { Image, Layout } from "@chia/components/shared";
import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote";
import { getPost, getAllPosts } from "@chia/helpers/mdx/services";
import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import type { PostFrontMatter } from "@chia/shared/types";
import * as mdxComponents from "@chia/components/pages/posts/MDXComponents";
import "highlight.js/styles/atom-one-dark-reasonable.css";
import { Chip } from "@chia/components/pages/posts";
import Giscus from "@giscus/react";
import type { GiscusProps } from "@giscus/react";
import { giscusConfig } from "@chia/config/giscus.config";
import { Chia } from "@chia/shared/meta/chia";
import { useIsMounted, useDarkMode } from "@chia/hooks";
import { BASE_URL } from "@chia/shared/constants";

interface Props {
  source: MDXRemoteProps;
  frontMatter: PostFrontMatter;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const data = await getAllPosts();
  const paths = data.map((p) => ({ params: { slug: p.slug } }));

  return {
    paths,
    fallback: false,
  };
};

// @ts-ignore
export const getStaticProps: GetStaticProps = async ({
  params,
}: {
  params: Pick<PostFrontMatter, "slug">;
}) => {
  const { frontMatter, source } = await getPost(params.slug);

  return {
    props: {
      frontMatter,
      source,
    },
  };
};

const PostPage: NextPage<Props> = ({ source, frontMatter }) => {
  const { isDarkMode } = useDarkMode();
  const isMounted = useIsMounted();

  const name = Chia.name;
  const chinese_name = Chia.chineseName;

  return (
    <Layout
      canonicalUrl={`${BASE_URL}/posts/${frontMatter?.slug}`}
      title={`${frontMatter?.title} | ${name} ${chinese_name}`}
      description={`${frontMatter?.excerpt}`}
      keywords={frontMatter?.tags}
      type="article">
      <article className="main c-container mt-10 px-5">
        <header className="pl-3 lg:w-[70%] w-full mb-7 self-center">
          <h1 className="title pb-5">{frontMatter?.title}</h1>
          <h2 className="c-description">{frontMatter?.excerpt}</h2>
          <span className="mt-5 flex items-center c-description gap-2">
            <Image
              src="/memoji/contact-memoji.PNG"
              width={40}
              height={40}
              className="rounded-full"
              alt="Chia1104"
            />
            {dayjs(frontMatter?.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
            {frontMatter?.readingMins}
          </span>
          <Chip data={frontMatter?.tags || []} />
        </header>
        <div className="c-bg-secondary p-5 mt-5 rounded-xl lg:w-[70%] w-full self-center mx-auto">
          <MDXRemote {...source} components={{ ...(mdxComponents as any) }} />
        </div>
        <div className="mt-20 lg:w-[70%] w-full self-center mx-auto">
          <Giscus
            {...(giscusConfig as GiscusProps)}
            term={frontMatter?.title}
            mapping="specific"
            reactionsEnabled="1"
            emitMetadata="0"
            theme={isMounted && isDarkMode ? "dark" : "light"}
          />
        </div>
      </article>
    </Layout>
  );
};

export default PostPage;
