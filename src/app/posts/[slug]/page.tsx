import { Page } from "@chia/components/client";
import { getAllPosts, getPost } from "@chia/helpers/mdx/services";
import { MDXRemote, Image, Giscus } from "@chia/components/client";
import "highlight.js/styles/atom-one-dark-reasonable.css";
import * as mdxComponents from "@chia/components/client/MDXComponents";
import { Chip } from "@chia/components/server";
import dayjs from "dayjs";

export const generateStaticParams = async () => {
  const posts = await getAllPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
};

const PostDetailPage = async ({ params }: { params?: any }) => {
  const { frontMatter, source } = await getPost(params.slug);
  return (
    <Page>
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
          <Giscus title={frontMatter?.title || ""} />
        </div>
      </article>
    </Page>
  );
};

export const dynamic = "force-static";

export default PostDetailPage;
