import type { MDXComponents } from "mdx/types";

import {
  FumadocsComponents,
  V1MDXComponents,
} from "@chia/contents/mdx-components";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...FumadocsComponents,
    ...V1MDXComponents,
    ...components,
  };
}
