import { type PostFrontMatter } from "@/shared/types";
import path from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import readingTime from "reading-time";
import { POSTS_PATH } from "@chia/utils";

export const getPostPaths = () => path.join(process.cwd(), POSTS_PATH);

export const getPostData = async (
  slug: string
): Promise<{
  content: string;
  frontMatter: PostFrontMatter;
}> => {
  const s = decodeURI(slug);

  const postDir = path.join(getPostPaths(), `${s}.mdx`);
  const source = await fs.readFile(postDir, "utf8");
  const { content, data } = matter(source);

  return {
    content,
    frontMatter: {
      ...(data as Partial<PostFrontMatter>),
      slug: encodeURI(s),
      createdAt: data.createdAt,
      published: data.published,
      readingMins: readingTime(source).text,
    },
  };
};
