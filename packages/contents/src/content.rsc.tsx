import { DocsBody } from "fumadocs-ui/page";
import type { MDXContent } from "mdx/types";

import { ContentType } from "@chia/db/types";
import { cn } from "@chia/ui/utils/cn.util";

import FeedContent from "./content";
import type { GetContentPropsReturn, ContentContextProps } from "./types";

export const MDXBody = (props: {
  className?: string;
  MDXContent: MDXContent;
}) => {
  return (
    <DocsBody
      className={cn(
        props.className,
        "prose dark:prose-invert w-full min-w-full lg:w-[70%] lg:min-w-[70%]"
      )}>
      <props.MDXContent />
    </DocsBody>
  );
};

export const Content = async (props: {
  content: GetContentPropsReturn;
  context?: Partial<ContentContextProps>;
}) => {
  const { content, ...rest } = await props.content;

  switch (rest.type) {
    case ContentType.Mdx: {
      if (props.context?.type !== ContentType.Mdx) {
        throw new Error(`Content context must be for MDX, not ${rest.type}`);
      }
      return (
        <FeedContent {...rest} {...props.context}>
          <MDXBody MDXContent={content as MDXContent} />
        </FeedContent>
      );
    }
    default:
      return null;
  }
};
