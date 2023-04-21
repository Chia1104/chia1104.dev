// import "server-only";
import path from "path";
import type { PostFrontMatter, PostSource } from "@/shared/types";
import { POSTS_PATH } from "@/shared/constants";
import { serialize } from "next-mdx-remote/serialize";
import { compileMDX } from "next-mdx-remote/rsc";
import pMap from "p-map";
import glob from "fast-glob";
import { getPostData } from "../repositories";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import rehypeHighlight from "rehype-highlight";
import rehypeCodeTitles from "rehype-code-titles";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { cache } from "react";
import { Components } from "./MDXRemote";

const PostsPath = path.join(process.cwd(), POSTS_PATH);

export const preload = (slug: string) => {
  void getPost(slug);
};

export const getSlugs = async (): Promise<string[]> =>
  (await glob("*.mdx", { cwd: PostsPath })).map((fileName) =>
    fileName.replace(/\.mdx$/, "")
  );

export const getEncodedSlugs = async (): Promise<string[]> =>
  (await glob("*.mdx", { cwd: PostsPath })).map((fileName) =>
    encodeURI(fileName.replace(/\.mdx$/, ""))
  );

export const getPost = cache(async (slug: string): Promise<PostSource> => {
  const { frontMatter, content } = await getPostData(slug);

  const source = await serialize(content, {
    parseFrontmatter: false,
    mdxOptions: {
      remarkPlugins: [[remarkGfm, { singleTilde: false }]],
      rehypePlugins: [
        [rehypeSlug],
        [rehypePrism, { ignoreMissing: true }],
        [
          rehypeAutolinkHeadings,
          {
            properties: { className: ["anchor"] },
          },
          { behaviour: "wrap" },
        ],
        rehypeHighlight,
        rehypeCodeTitles,
      ],
    },
  });

  return {
    frontMatter,
    source: { ...source },
  };
});

export const getCompiledSource = cache(
  async (
    slug: string
  ): Promise<{
    content: JSX.Element;
    frontmatter: PostFrontMatter;
  }> => {
    const { frontMatter, content } = await getPostData(slug);

    const source = await compileMDX({
      source: content,
      options: {
        mdxOptions: {
          remarkPlugins: [[remarkGfm, { singleTilde: false }]],
          rehypePlugins: [
            [rehypeSlug],
            [rehypePrism, { ignoreMissing: true }],
            [
              rehypeAutolinkHeadings,
              {
                properties: { className: ["anchor"] },
              },
              { behaviour: "wrap" },
            ],
            rehypeHighlight,
            rehypeCodeTitles,
          ],
        },
        parseFrontmatter: false,
      },
      components: { ...(Components as any) },
    });
    return {
      frontmatter: frontMatter,
      content: source.content,
    };
  }
);

export const getSource = cache(async (slug: string): Promise<string> => {
  const { content } = await getPostData(slug);

  return content;
});

export const getAllPosts = cache(async (): Promise<PostFrontMatter[]> => {
  const slugs = await getSlugs();

  return (
    await pMap(slugs, async (slug) => (await getPostData(slug)).frontMatter, {
      stopOnError: true,
    })
  )
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .filter((post) => post.published);
});
