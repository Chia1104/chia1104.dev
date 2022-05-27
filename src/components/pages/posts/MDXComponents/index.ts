import { MDXImage } from "@/components/pages/posts/MDXComponents/MDXImage"
import { MDXLink } from "@/components/pages/posts/MDXComponents/MDXLink"
import { MDXCode, MDXPre, MDXCodeOrigin } from "@/components/pages/posts/MDXComponents/MDXCode"
import { h1, h2, h4, h3, h5, h6 } from "@/components/pages/posts/MDXComponents/MDXHeading"
import { MDXOl, MDXUl } from "@/components/pages/posts/MDXComponents/MDXList"
import {  MDXTable, MDXTh, MDXTd } from "@/components/pages/posts/MDXComponents/MDXTable"
import { MDXQuote } from "@/components/pages/posts/MDXComponents/MDXQuote"
import { Typography } from "@mui/material";
import {MDXDivider, MDXHr} from "@/components/pages/posts/MDXComponents/MDXDivider";
import { MDXBr } from "@/components/pages/posts/MDXComponents/MDXBr";

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
    ol: MDXOl,
    hr: MDXHr,
    Divider: MDXDivider,
    table: MDXTable,
    th: MDXTh,
    td: MDXTd,
    code: MDXCodeOrigin,
    Quote: MDXQuote,
    br: MDXBr
}
