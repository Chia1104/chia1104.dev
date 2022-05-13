import path from 'path'
import fs from "fs/promises";
import matter from 'gray-matter'
import readingTime from 'reading-time'
import { PostFrontMatter, PostSource } from "@/utils/types/post";
import { POSTS_PATH } from "@/utils/constants";
import { serialize } from "next-mdx-remote/serialize";
import { minify } from "uglify-js";
import pMap from "p-map";

// remark/rehype markdown plugins
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import rehypeHighlight from 'rehype-highlight'
import rehypeCodeTitles from 'rehype-code-titles'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

const postsPath = path.join(process.cwd(), POSTS_PATH)

export const getSlugs = async (): Promise<string[]> => {
    const files = await fs.readdir(postsPath);

    return files
        .filter((file) => /\.mdx$/.test(file))
        .map((noteFile) => noteFile.replace(/\.mdx$/, ""));
}

export const getPostData = async (
    slug: string
): Promise<{
    content: string;
    frontMatter: PostFrontMatter;
}> => {
    const postDir = path.join(postsPath, `${slug}.mdx`)
    const source = await fs.readFile(postDir, 'utf8')
    const { content, data } = matter(source)

    return {
        content,
        frontMatter: {
            ...(data as Partial<PostFrontMatter>),
            slug,
            createdAt: data.createdAt,
            readingMins: readingTime(source).text,
        },
    }
}

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
                        properties: { className: ['anchor'] },
                    },
                    { behaviour: 'wrap' },
                ],
                rehypeHighlight,
                rehypeCodeTitles,
            ],
        },
    });

    // HACK: next-mdx-remote v4 doesn't (yet?) minify compiled JSX output, see:
    // https://github.com/hashicorp/next-mdx-remote/pull/211#issuecomment-1013658514
    // ...so for now, let's do it manually (and conservatively) with uglify-js when building for production.
    const compiledSource =
        process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
            ? minify(source.compiledSource, {
                toplevel: true,
                parse: {
                    bare_returns: true,
                },
            }).code
            : source.compiledSource;

    return {
        frontMatter,
        source: {
            compiledSource,
        },
    };
};

export const getAllPosts = async (): Promise<PostFrontMatter[]> => {
    const slugs = await getSlugs();

    const data = await pMap(slugs, async (slug) =>
        (await getPostData(slug)).frontMatter, {
        stopOnError: true,
    });

    data
        .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

    return data;
};
