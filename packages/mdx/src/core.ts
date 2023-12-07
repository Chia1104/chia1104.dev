import { compileMDX as _compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypePrism from "rehype-prism-plus";

export const compileMDX = async (content: string) => {
  return await _compileMDX({
    source: content,
    options: {
      mdxOptions: {
        remarkPlugins: [[remarkGfm, { singleTilde: false }]],
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
        ],
      },
    },
  });
};
