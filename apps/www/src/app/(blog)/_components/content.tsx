import { compileMDX } from "@fumadocs/mdx-remote";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { DocsBody } from "fumadocs-ui/page";
import { cn } from "~/packages/ui";

import { fumadocsComponents } from "@/mdx-components";

interface BaseProps {
  content: string;
  className?: string;
}

type Props = {
  type?: "mdx" | "md" | "notion" | "sanity" | "tiptap" | null;
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
      <div className="[&>*]:w-full mb-14 w-full">
        <InlineTOC items={compiled.toc} />
      </div>
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
    default:
      return null;
  }
};

export default Content;
