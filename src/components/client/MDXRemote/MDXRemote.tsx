"use client";

import { MDXRemote as MDXR, MDXRemoteSerializeResult } from "next-mdx-remote";
import { SerializedResult, useDeserialized } from "@chia/utils/hydration.util";
import type { FC } from "react";
import * as mdxComponents from "@chia/components/client/MDXComponents";

interface Props {
  post: SerializedResult<MDXRemoteSerializeResult>;
}

const MDXRemote: FC<Props> = (props) => {
  const { post } = props;
  const _post = useDeserialized(post);
  return <MDXR {..._post} components={{ ...(mdxComponents as any) }} />;
};

export default MDXRemote;
