import { compileMDX as _compileMDX } from "next-mdx-remote/rsc";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import { serialize } from "next-mdx-remote/serialize";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypePrism from "rehype-prism-plus";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

export const serializeMDX = async (
  content: string,
  options?: MDXRemoteProps
) => {
  return await serialize(content, {
    options: { parseFrontmatter: false },
    mdxOptions: {
      remarkPlugins: [
        [remarkGfm, { singleTilde: false }],
        ...(options?.options?.mdxOptions?.remarkPlugins ?? []),
      ],
      rehypePlugins: [
        [rehypeSlug],
        [rehypePrism, { ignoreMissing: true }],
        [rehypeAutolinkHeadings],
        [
          rehypePrettyCode,
          {
            theme: {
              light: "github-light",
              dark: "github-dark",
            },
            keepBackground: false,
          },
        ],
        ...(options?.options?.mdxOptions?.rehypePlugins ?? []),
      ],
      ...options?.options?.mdxOptions,
    },
    ...options,
  });
};

export const compileMDX = async (content: string, options?: MDXRemoteProps) => {
  return await _compileMDX({
    ...options,
    source: content,
    options: {
      parseFrontmatter: false,
      mdxOptions: {
        remarkPlugins: [
          [remarkGfm, { singleTilde: false }],
          ...(options?.options?.mdxOptions?.remarkPlugins ?? []),
        ],
        rehypePlugins: [
          [rehypeSlug],
          [rehypePrism, { ignoreMissing: true }],
          [rehypeAutolinkHeadings],
          [
            rehypePrettyCode,
            {
              theme: {
                light: "github-light",
                dark: "github-dark",
              },
              keepBackground: false,
            },
          ],
          ...(options?.options?.mdxOptions?.rehypePlugins ?? []),
        ],
        ...options?.options?.mdxOptions,
      },
      ...options?.options,
    },
  });
};
