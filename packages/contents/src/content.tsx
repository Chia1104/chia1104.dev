"use client";

import type { ReactNode, Ref } from "react";
import { useRef, ViewTransition } from "react";

import { Card, ScrollShadow } from "@heroui/react";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { TOCItems } from "fumadocs-ui/components/toc/clerk";
import { TOCProvider, TOCScrollArea } from "fumadocs-ui/components/toc/index";

import { ContentType } from "@chia/db/types";
import DateFormat from "@chia/ui/date-format";

import { ContentContext, useContent } from "./content.context";
import type {
  BaseProps,
  BasePropsWithType,
  ContentContextProps,
} from "./types";

const ContentProvider = ({
  children,
  ...props
}: ContentContextProps & { children?: ReactNode }) => {
  return <ContentContext value={props}>{children}</ContentContext>;
};

const MDXInlineTOC = () => {
  const content = useContent();
  if (content.type === ContentType.Mdx) {
    return (
      <InlineTOC
        items={content.toc}
        className="bg-surface rounded-2xl border-none"
      />
    );
  }
  return null;
};

const MDXTableOfContents = <TContainer extends HTMLElement>(_props: {
  containerRef: Ref<TContainer>;
}) => {
  const content = useContent();
  if (content.type === ContentType.Mdx) {
    return (
      <TOCProvider toc={content.toc}>
        <TOCScrollArea className="max-h-[300px] w-full py-1">
          <TOCItems className="[&>a]:py-1" />
        </TOCScrollArea>
      </TOCProvider>
    );
  }
  return null;
};

const MdxContent = (props: BaseProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const content = useContent();
  return (
    <div className="w-full">
      <div className="mb-14 w-full [&>*]:w-full">
        <MDXInlineTOC />
      </div>
      <div
        className="prose-code:text-[13px] prose-code:font-normal relative flex w-full"
        ref={containerRef}>
        {props.children}
        <div className="not-prose sticky top-24 ml-2 flex hidden h-fit w-[30%] flex-col lg:flex">
          <Card className="w-full">
            <Card.Header>
              {content.tocContents?.label ?? "On this page"}
            </Card.Header>
            <ScrollShadow className="max-h-[300px] w-full">
              <Card.Content className="gap-1 pt-0 pl-0">
                <MDXTableOfContents containerRef={containerRef} />
              </Card.Content>
            </ScrollShadow>
            {props.updatedAt || props.slot?.tocFooter ? (
              <Card.Footer className="flex flex-col">
                <div className="flex w-full flex-wrap items-center justify-between gap-1 self-start text-sm">
                  <span>
                    {content.tocContents?.updated ?? "Last updated"}:{" "}
                    <ViewTransition>
                      <DateFormat
                        date={props.updatedAt}
                        format="YYYY/MM/DD"
                        locale={props.locale}
                      />
                    </ViewTransition>
                  </span>
                  {props.slot?.afterLastUpdate}
                </div>
              </Card.Footer>
            ) : null}
          </Card>
          {props.slot?.tocFooter}
        </div>
      </div>
    </div>
  );
};

const Content = ({ type, ...props }: BasePropsWithType) => {
  switch (type) {
    case "mdx": {
      return <MdxContent {...props} />;
    }
    default:
      return null;
  }
};

const Index = (props: ContentContextProps) => {
  return (
    <ContentProvider {...props}>
      <Content {...props} />
    </ContentProvider>
  );
};

export default Index;
