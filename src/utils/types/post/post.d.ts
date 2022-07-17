import type { MDXRemoteSerializeResult } from "next-mdx-remote";

export type PostFrontMatter = {
    slug: string;
    id?: number;
    title?: string;
    excerpt?: string;
    tags?: string[];
    headImg?: string;
    createdAt: string;
    updateAt?: string;
    readingMins: string;
    published: boolean;
    content?: string;
}

export type PostSource = {
    source: MDXRemoteSerializeResult;
    frontMatter: PostFrontMatter;
}
