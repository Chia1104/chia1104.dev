"use client";

import {
  MDXRemote as MDXR,
  type MDXRemoteSerializeResult,
} from "next-mdx-remote";
import { type FC, useDeferredValue } from "react";
import * as mdxComponents from "@chia/components/client/MDXComponents";

interface Props {
  serializeResult: MDXRemoteSerializeResult;
  content?: string;
}

const MDXRemote: FC<Props> = ({ serializeResult }) => {
  return (
    <MDXR {...serializeResult} components={{ ...(mdxComponents as any) }} />
  );
};

export default MDXRemote;
