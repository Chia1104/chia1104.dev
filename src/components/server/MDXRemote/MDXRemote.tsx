import {
  MDXRemote as MDXR,
  type MDXRemoteSerializeResult,
  type MDXRemoteProps,
} from "next-mdx-remote/rsc";
import * as mdxComponents from "@chia/components/client/MDXComponents";

interface Props {
  post: MDXRemoteSerializeResult;
}

const MDXRemote = ({ post }: Props) => {
  return (
    // @ts-ignore
    <MDXR {...post} components={{ ...(mdxComponents as any) }} />
  );
};

export default MDXRemote;
