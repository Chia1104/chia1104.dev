import {
  compileMDX as _compileMDX,
  type MDXRemoteProps,
} from "next-mdx-remote/rsc";
import { serialize } from "next-mdx-remote/serialize";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypePrism from "rehype-prism-plus/generator";

export const serializeMDX = async (
  content: string,
  options?: MDXRemoteProps
) => {
  return await serialize(content, {
    mdxOptions: {
      parseFrontmatter: false,
      remarkPlugins: [
        [remarkGfm, { singleTilde: false }],
        ...(options?.options?.mdxOptions?.remarkPlugins ?? []),
      ],
      rehypePlugins: [
        [rehypeSlug],
        [rehypePrism, { ignoreMissing: true }],
        [rehypeAutolinkHeadings],
        [
          // @ts-ignore
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
      mdxOptions: {
        parseFrontmatter: false,
        remarkPlugins: [
          [remarkGfm, { singleTilde: false }],
          ...(options?.options?.mdxOptions?.remarkPlugins ?? []),
        ],
        rehypePlugins: [
          [rehypeSlug],
          [rehypePrism, { ignoreMissing: true }],
          [rehypeAutolinkHeadings],
          [
            // @ts-ignore
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
