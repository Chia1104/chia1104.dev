import { dataToJSON } from "../repositories";
import {query, where, orderBy, collectionGroup, limit, getDocs, doc, getDoc} from 'firebase/firestore';
import { firestore } from '../../config';
// import { PostFrontMatter, PostSource } from "@/utils/types/post";
// import readingTime from "reading-time";
// import { serialize } from "next-mdx-remote/serialize";
// import { minify } from "uglify-js";
// import rehypeSlug from "rehype-slug";
// import remarkGfm from "remark-gfm";
// import rehypePrism from "rehype-prism-plus";
// import rehypeHighlight from 'rehype-highlight'
// import rehypeCodeTitles from 'rehype-code-titles'
// import rehypeAutolinkHeadings from 'rehype-autolink-headings'

export const queryPosts = async (Limit: number): Promise<Promise<JSON>[]> => {
    const ref = await collectionGroup(firestore, 'posts');
    const postsQuery = query(
        ref,
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
        limit(Limit),
    )
    return(await getDocs(postsQuery)).docs.map(dataToJSON);
}

export const getPostData = async (slug: string): Promise<JSON> => {
    const ref = await doc(firestore, `posts/${slug}`);
    return dataToJSON(await getDoc(ref));
}

// export const getPost = async (slug: string): Promise<PostSource> => {
//     const data = await getPostData(slug);
//
//     const source = await serialize(data.content, {
//         parseFrontmatter: false,
//         mdxOptions: {
//             remarkPlugins: [[remarkGfm, { singleTilde: false }]],
//             rehypePlugins: [
//                 [rehypeSlug],
//                 [rehypePrism, { ignoreMissing: true }],
//                 [
//                     rehypeAutolinkHeadings,
//                     {
//                         properties: { className: ['anchor'] },
//                     },
//                     { behaviour: 'wrap' },
//                 ],
//                 rehypeHighlight,
//                 rehypeCodeTitles,
//             ],
//         },
//     });
//     const compiledSource =
//         process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
//             ? minify(source.compiledSource, {
//                 toplevel: true,
//                 parse: {
//                     bare_returns: true,
//                 },
//             }).code
//             : source.compiledSource;
//
// }

export const getPostsPath = async (): Promise<string[]> => {
    const ref = await collectionGroup(firestore, 'posts');
    const postsQuery = query(
        ref,
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
    )

    const snapshot = await getDocs(postsQuery);
    return snapshot.docs.map(doc => {
        const { slug } = doc.data();
        return slug;
    });
}
