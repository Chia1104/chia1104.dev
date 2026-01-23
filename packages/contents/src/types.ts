import type { ConfigType } from "dayjs";
import type { TableOfContents } from "fumadocs-core/toc";
import type { MDXContent } from "mdx/types";

import type { Content } from "@chia/db/schema";
import type { ContentType } from "@chia/db/types";

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

export interface BasePropsWithType extends BaseProps {
  type: ContentType;
}

export type ContentProps = BaseProps &
  (
    | {
        type: typeof ContentType.Mdx;
        toc: TableOfContents;
        content: MDXContent;
      }
    | {
        type: typeof ContentType.Tiptap;
        content?: string | null;
      }
    | {
        type: typeof ContentType.Plate;
        content?: string | null;
      }
    | {
        type: typeof ContentType.Notion;
        content?: string | null;
      }
  );

export type ContentContextProps = BaseProps &
  (
    | {
        type: typeof ContentType.Mdx;
        toc: TableOfContents;
      }
    | {
        type: typeof ContentType.Tiptap;
        content?: string | null;
      }
    | {
        type: typeof ContentType.Plate;
        content?: string | null;
      }
    | {
        type: typeof ContentType.Notion;
        content?: string | null;
      }
  );

export interface GetContentPropsArgs {
  contentType: ContentType;
  content: Partial<Omit<Content, "createdAt" | "updatedAt">> & {
    createdAt?: ConfigType;
    updatedAt?: ConfigType;
  };
}

export type GetContentPropsReturn = Promise<ContentProps>;
