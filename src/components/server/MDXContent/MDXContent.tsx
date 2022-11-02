import { jsxRuntime } from "./jsx-runtime.cjs";
import * as mdx from "@mdx-js/react";
import { type MDXRemoteSerializeResult } from "next-mdx-remote";
import type { ComponentProps, ElementType } from "react";

export type MDXRemoteProps = MDXRemoteSerializeResult & {
  components?: ComponentProps<typeof mdx.MDXProvider>["components"];
};

/**
 * 🚧 Work in progress 🚧
 */
const MDXContent: ElementType = ({ compiledSource }: MDXRemoteProps) => {
  const fullScope = Object.assign({ opts: { ...mdx, ...jsxRuntime } });
  const keys = Object.keys(fullScope);
  const values = Object.values(fullScope);

  const hydrateFn = Reflect.construct(
    Function,
    keys.concat(`${compiledSource}`)
  );

  return hydrateFn.apply(hydrateFn, values).default;
};

export default MDXContent;
