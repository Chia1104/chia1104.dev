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
    tocFooter?: React.ReactNode;
    afterLastUpdate?: React.ReactNode;
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
}

export type GetContentPropsReturn = Promise<ContentProps>;
