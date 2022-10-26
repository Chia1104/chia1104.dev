import path from "path";
import type { PostFrontMatter, PostSource } from "@chia/shared/types";
import { POSTS_PATH } from "@chia/shared/constants";
import { serialize } from "next-mdx-remote/serialize";
import pMap from "p-map";
import glob from "fast-glob";
import { getPostData } from "../repositories";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import rehypeHighlight from "rehype-highlight";
import rehypeCodeTitles from "rehype-code-titles";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

const PostsPath = path.join(process.cwd(), POSTS_PATH);

export const getSlugs = async (): Promise<string[]> => {
  const mdxFiles = await glob("*.mdx", { cwd: PostsPath });

  return mdxFiles.map((fileName) => fileName.replace(/\.mdx$/, ""));
};

export const getEncodedSlugs = async (): Promise<string[]> => {
  const mdxFiles = await glob("*.mdx", { cwd: PostsPath });

  return mdxFiles.map((fileName) => encodeURI(fileName.replace(/\.mdx$/, "")));
};

export const getPost = async (slug: string): Promise<PostSource> => {
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
    source: {
      compiledSource: source.compiledSource,
    },
  };
};

export const getAllPosts = async (): Promise<PostFrontMatter[]> => {
  const slugs = await getSlugs();

  const data = await pMap(
    slugs,
    async (slug) => (await getPostData(slug)).frontMatter,
    {
      stopOnError: true,
    }
  );

  data.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  return data.filter((post) => post.published);
};
