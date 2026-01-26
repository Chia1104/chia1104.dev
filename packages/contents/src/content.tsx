"use client";

import type { ReactNode, Ref, RefObject } from "react";
import { useRef, ViewTransition } from "react";

import { Card, ScrollShadow } from "@heroui/react";
import * as Base from "fumadocs-core/toc";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";

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

const MDXTableOfContents = <TContainer extends HTMLElement>(props: {
  containerRef: Ref<TContainer>;
}) => {
  const content = useContent();
  if (content.type === ContentType.Mdx) {
    return (
      <Base.AnchorProvider toc={content.toc} single={false}>
        <Base.ScrollProvider
          containerRef={props.containerRef as RefObject<TContainer>}>
          {content.toc.map((item) => (
            <Base.TOCItem
              key={item.url}
              style={{
                paddingLeft: `${item.depth * 0.5}rem`,
              }}
              href={item.url}
              className="text-sm text-gray-500 transition-colors dark:text-gray-400 [&[data-active='true']]:text-black dark:[&[data-active='true']]:text-white">
              {item.title}
            </Base.TOCItem>
          ))}
        </Base.ScrollProvider>
      </Base.AnchorProvider>
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
