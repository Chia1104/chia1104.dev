import { MDXRemote as MDXR, type MDXRemoteProps } from "next-mdx-remote/rsc";
import * as MDXComponents from "@chia/components/client/MDXComponents";

const Components: typeof MDXComponents = {
  Image: (props) => <MDXComponents.Image {...props} />,
  a: (props) => <MDXComponents.a {...props} />,
  Code: (props) => <MDXComponents.Code {...props} />,
  Quote: (props) => <MDXComponents.Quote {...props} />,
  pre: (props) => <MDXComponents.pre {...props} />,
  code: (props) => <MDXComponents.code {...props} />,
  h1: (props) => <MDXComponents.h1 {...props} />,
  h2: (props) => <MDXComponents.h2 {...props} />,
  h3: (props) => <MDXComponents.h3 {...props} />,
  h4: (props) => <MDXComponents.h4 {...props} />,
  h5: (props) => <MDXComponents.h5 {...props} />,
  h6: (props) => <MDXComponents.h6 {...props} />,
  p: (props) => <MDXComponents.p {...props} />,
  ol: (props) => <MDXComponents.ol {...props} />,
  ul: (props) => <MDXComponents.ul {...props} />,
  th: (props) => <MDXComponents.th {...props} />,
  td: (props) => <MDXComponents.td {...props} />,
  tr: (props) => <MDXComponents.tr {...props} />,
  table: (props) => <MDXComponents.table {...props} />,
  tbody: (props) => <MDXComponents.tbody {...props} />,
  thead: (props) => <MDXComponents.thead {...props} />,
  strong: (props) => <MDXComponents.strong {...props} />,
  hr: (props) => <MDXComponents.hr {...props} />,
  br: (props) => <MDXComponents.br {...props} />,
  Spacer: (props) => <MDXComponents.Spacer {...props} />,
  CodeSandBox: (props) => <MDXComponents.CodeSandBox {...props} />,
  Youtube: (props) => <MDXComponents.Youtube {...props} />,
  img: (props) => <MDXComponents.Image {...props} />,
};

const MDXRemote = (props: MDXRemoteProps) => (
  // @ts-ignore
  <MDXR
    {...props}
    components={{ ...(Components as any), ...(props.components || {}) }}
  />
);

export default MDXRemote;
export { Components };
