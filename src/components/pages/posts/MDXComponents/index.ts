import { MDXImage } from "@/components/pages/posts/MDXComponents/MDXImage"
import { MDXLink } from "@/components/pages/posts/MDXComponents/MDXLink"
import { MDXCode } from "@/components/pages/posts/MDXComponents/MDXCode"
import { MDXTitle } from "@/components/pages/posts/MDXComponents/MDXTitle"
import { MDXArticle } from "@/components/pages/posts/MDXComponents/MDXArticle"
import { MDXTitle2 } from "@/components/pages/posts/MDXComponents/MDXTitle2"
import { h1, h2, h4, h3, h5, h6 } from "@/components/pages/posts/MDXComponents/MDXHeading"
import { Typography } from "@mui/material";

export const MDXComponents = {
    Image: MDXImage,
    Link: MDXLink,
    Code: MDXCode,
    Title: MDXTitle,
    Article: MDXArticle,
    Title2: MDXTitle2,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p: Typography
}
