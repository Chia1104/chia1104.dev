import { FC } from 'react';
import { MDXImage } from "@/components/pages/posts/MDXComponents/MDXImage";
import { MDXLink } from "@/components/pages/posts/MDXComponents/MDXLink";
import { MDXCode } from "@/components/pages/posts/MDXComponents/MDXCode";
import { MDXTitle } from "@/components/pages/posts/MDXComponents/MDXTitle";
import { MDXArticle } from "@/components/pages/posts/MDXComponents/MDXArticle";


export const MDXComponents = {
    Image: MDXImage,
    a: MDXLink,
    Title: MDXTitle,
    Code: MDXCode,
    Article: MDXArticle,
}
