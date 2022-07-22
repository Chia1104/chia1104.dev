import { type PostFrontMatter } from "@chia/utils/types/post";
import path from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import readingTime from "reading-time";
import { POSTS_PATH } from "@chia/utils/constants";

const PostsPath = path.join(process.cwd(), POSTS_PATH);

export const getPostData = async (
  slug: string
): Promise<{
  content: string;
  frontMatter: PostFrontMatter;
}> => {
  const s = decodeURI(slug);

  const postDir = path.join(PostsPath, `${s}.mdx`);
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
