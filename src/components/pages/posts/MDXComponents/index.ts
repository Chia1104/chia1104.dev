import { MDXImage } from "@/components/pages/posts/MDXComponents/MDXImage"
import { MDXLink } from "@/components/pages/posts/MDXComponents/MDXLink"
import { MDXCode, MDXPre, MDXCodeOrigin } from "@/components/pages/posts/MDXComponents/MDXCode"
import { h1, h2, h4, h3, h5, h6 } from "@/components/pages/posts/MDXComponents/MDXHeading"
import { MDXList, MDXUl } from "@/components/pages/posts/MDXComponents/MDXList"
import {  MDXTable, MDXTh, MDXTd } from "@/components/pages/posts/MDXComponents/MDXTable"
import { Typography } from "@mui/material";

export const MDXComponents = {
    Image: MDXImage,
    a: MDXLink,
    Code: MDXCode,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p: Typography,
    pre: MDXPre,
    ul: MDXUl,
    List: MDXList,
    table: MDXTable,
    th: MDXTh,
    td: MDXTd,
    code: MDXCodeOrigin,
}
