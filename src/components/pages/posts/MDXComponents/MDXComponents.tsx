import dynamic from "next/dynamic";

const MDXImage = dynamic(() => import("@/components/pages/posts/MDXComponents/MDXImage"));
const MDXLink = dynamic(() => import("@/components/pages/posts/MDXComponents/MDXLink"));
const MDXCode = dynamic(() => import("@/components/pages/posts/MDXComponents/MDXCode"));
const MDXTitle = dynamic(() => import("@/components/pages/posts/MDXComponents/MDXTitle"));
const MDXArticle = dynamic(() => import("@/components/pages/posts/MDXComponents/MDXArticle"));
const MDXTitle2 = dynamic(() => import("@/components/pages/posts/MDXComponents/MDXTitle2"));


export const MDXComponents = {
    Image: MDXImage,
    a: MDXLink,
    Title: MDXTitle,
    Code: MDXCode,
    Article: MDXArticle,
    Title2: MDXTitle2,
}
