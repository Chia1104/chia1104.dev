"use client";

import type { ReactNode } from "react";
import { useRef, ViewTransition } from "react";

import { Card, ScrollShadow } from "@heroui/react";
import { ScrollProvider as TOCScrollArea } from "fumadocs-core/toc";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { TOCProvider, useTOCItems } from "fumadocs-ui/components/toc";
import {
  TOCItems as TOCItemEffect,
  TOCItem,
  TOCEmpty,
} from "fumadocs-ui/components/toc/clerk";

import DateFormat from "@chia/ui/date-format";

import { ContentContext, useContent } from "./content.context";
import type { BaseProps, ContentContextProps } from "./types";

const ContentProvider = ({
  children,
  ...props
}: ContentContextProps & { children?: ReactNode }) => {
  return <ContentContext value={props}>{children}</ContentContext>;
};

const MDXInlineTOC = () => {
  const content = useContent();
  return (
    <InlineTOC
      items={content.toc}
      className="bg-surface rounded-2xl border-none"
    />
  );
};

const TOCItems = () => {
  const items = useTOCItems();

  if (items.length === 0) {
    return <TOCEmpty />;
  }

  return (
    <>
      {items.map((item) => (
        <TOCItem key={item.url} item={item} />
      ))}
    </>
  );
};

const ContentTOC = () => {
  const content = useContent();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <TOCProvider toc={content.toc}>
      <ScrollShadow
        ref={contentRef}
        className="max-h-[300px] w-full py-1"
        hideScrollBar>
        <TOCScrollArea containerRef={contentRef}>
          <TOCItemEffect className="[&>a]:py-1">
            <TOCItems />
          </TOCItemEffect>
        </TOCScrollArea>
      </ScrollShadow>
    </TOCProvider>
  );
};

const MdxContent = (props: BaseProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const content = useContent();
  return (
    <div className="w-full">
      <div className="mb-14 w-full *:w-full">
        <MDXInlineTOC />
      </div>
      <div
        className="prose-code:text-[13px] prose-code:font-normal relative flex w-full"
        ref={containerRef}>
        {props.children}
        <div className="not-prose sticky top-24 ml-2 hidden h-fit w-[30%] flex-col lg:flex">
          <Card className="w-full">
            <Card.Header>
              {content.tocContents?.label ?? "On this page"}
            </Card.Header>
            <Card.Content className="gap-1 pt-0 pl-0">
              <ContentTOC />
            </Card.Content>
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

const Index = (props: ContentContextProps) => {
  return (
    <ContentProvider {...props}>
      <MdxContent {...props} />
    </ContentProvider>
  );
};

export default Index;
