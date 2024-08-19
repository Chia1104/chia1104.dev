import { compileMDX } from "@fumadocs/mdx-remote";
import { DocsBody } from "fumadocs-ui/page";

import type { ContentType } from "@chia/db/types";
import { cn } from "@chia/ui";

import { fumadocsComponents } from "@/mdx-components";

interface BaseProps {
  content: string;
  className?: string;
}

type Props = {
  type?: ContentType;
} & BaseProps;

const MdxContent = async (props: BaseProps) => {
  const compiled = await compileMDX({
    source: props.content,
    components: {
      ...fumadocsComponents,
    },
  });

  return (
    <>
      <DocsBody
        className={cn(
          props.className,
          "prose dark:prose-invert w-full min-w-full prose-a:no-underline"
        )}>
        {compiled.content}
      </DocsBody>
    </>
  );
};

const Content = (props: Props) => {
  switch (props.type) {
    case "mdx": {
      return <MdxContent {...props} />;
    }
    case "tiptap": {
      return <div dangerouslySetInnerHTML={{ __html: props.content }} />;
    }
    default:
      return null;
  }
};

export default Content;
