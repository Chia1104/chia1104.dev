import { compileMDX } from "@fumadocs/mdx-remote";
import defaultComponents from "fumadocs-ui/mdx";
import { DocsBody } from "fumadocs-ui/page";
import { cn } from "@chia/ui";

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
      ...defaultComponents,
    },
  });

  return (
    <main className="w-full">
      <DocsBody className={cn(props.className)}>{compiled.content}</DocsBody>
    </main>
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
