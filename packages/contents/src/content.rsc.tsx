import { DocsBody } from "fumadocs-ui/page";

import { cn } from "@chia/ui/utils/cn.util";

import FeedContent from "./content";
import type {
  ContentContextProps,
  ContentProps,
  GetContentPropsReturn,
} from "./types";

export const MDXBody = (props: {
  className?: string;
  MDXContent: ContentProps["content"];
}) => {
  return (
    <DocsBody
      className={cn(props.className, "prose dark:prose-invert w-full min-w-0")}>
      <props.MDXContent />
    </DocsBody>
  );
};

export const Content = async (props: {
  content: GetContentPropsReturn;
  context?: Partial<ContentContextProps>;
  className?: string;
}) => {
  const { content, ...rest } = await props.content;
  return (
    <FeedContent {...rest} {...props.context}>
      <MDXBody MDXContent={content} className={props.className} />
    </FeedContent>
  );
};
