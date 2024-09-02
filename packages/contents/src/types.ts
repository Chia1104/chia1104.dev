import type { ReactElement } from "react";

import type { TableOfContents } from "fumadocs-core/server";

import type { ContentType } from "@chia/db/types";

export interface BaseProps {
  className?: string;
  updatedAt?: Date | string | number;
}

export interface BasePropsWithType extends BaseProps {
  type: ContentType;
}

export type ContentProps = BaseProps &
  (
    | {
        type: typeof ContentType.Mdx;
        toc: TableOfContents;
        content: ReactElement;
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
