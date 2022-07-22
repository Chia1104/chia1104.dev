import { dataToJSON } from "../repositories";
import {
  query,
  orderBy,
  limit,
  getDocs,
  collection,
  getDoc,
  doc,
  where,
} from "firebase/firestore";
import { firestore } from "../../../firebase.config";
import type { PostFrontMatter, PostSource } from "@chia/utils/types/post";
import readingTime from "reading-time";
import { serialize } from "next-mdx-remote/serialize";
import { minify } from "uglify-js";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import rehypeHighlight from "rehype-highlight";
import rehypeCodeTitles from "rehype-code-titles";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

export const queryPosts = async (Limit: number): Promise<Promise<JSON>[]> => {
  const ref = await collection(firestore, "posts");
  const postsQuery = query(
    ref,
    where("published", "==", true),
    orderBy("createdAt", "desc"),
    limit(Limit)
  );
  return (await getDocs(postsQuery)).docs.map(dataToJSON);
};

export const getPostDataFire = async (
  id: string,
  slug?: string
): Promise<{
  content: string;
  frontMatter: PostFrontMatter;
}> => {
  const ref = doc(firestore, `products/${id}`);

  const j = dataToJSON(await getDoc(ref));

  return {
    // content: (j.content).replaceAll('\\n', '\n'),
    content: j.content,
    frontMatter: {
      ...j,
      readingMins: readingTime(j.content).text,
    },
  };
};

export const getPostFire = async (
  id: string,
  slug?: string
): Promise<PostSource> => {
  const { frontMatter, content } = await getPostDataFire(id);

  const s = await serialize(content, {
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
  const compiledSource =
    process.env.NODE_ENV === "production"
      ? minify(s.compiledSource, {
          toplevel: true,
          parse: {
            bare_returns: true,
          },
        }).code
      : s.compiledSource;

  return {
    frontMatter,
    source: {
      compiledSource,
    },
  };
};

export const getPostsPath = async (): Promise<string[]> => {
  const ref = await collection(firestore, "posts");
  const postsQuery = query(
    ref,
    where("published", "==", true),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(postsQuery);
  return snapshot.docs.map((doc) => {
    const { slug } = doc.data();
    return slug;
  });
};
