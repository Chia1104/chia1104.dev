"use client";

import {
  MDXRemote as MDXR,
  type MDXRemoteSerializeResult,
} from "next-mdx-remote";
import type { FC } from "react";
import * as mdxComponents from "@chia/components/client/MDXComponents";

interface Props {
  post: MDXRemoteSerializeResult;
}

const MDXRemote: FC<Props> = ({ post }) => {
  return <MDXR {...post} components={{ ...(mdxComponents as any) }} />;
};

export default MDXRemote;
