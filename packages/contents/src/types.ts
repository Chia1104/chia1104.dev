import type { TableOfContents } from "fumadocs-core/toc";
import type { MDXComponents } from "mdx/types";

import type { ConfigType } from "@chia/utils/day";

export interface BaseProps {
  className?: string;
  updatedAt?: ConfigType;
  tz?: string;
  locale?: string;
  tocContents?: {
    label?: string;
    updated?: string;
  };
  children?: React.ReactNode;
  slot?: {
    /** Host controls that close the article, beside the revision line. */
    actions?: React.ReactNode;
  };
}

export interface ContentProps extends BaseProps {
  toc: TableOfContents;
  content: React.FC<{
    components?: MDXComponents;
  }>;
}

export interface ContentContextProps extends BaseProps {
  toc: TableOfContents;
}

export interface GetContentPropsArgs {
  /** Raw MDX body. */
  content: string | null | undefined;
  /** Host overrides for the shared components, such as a `Tweet` that fetches its post. */
  components?: MDXComponents;
}

export type GetContentPropsReturn = Promise<ContentProps>;
