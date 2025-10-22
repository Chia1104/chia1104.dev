"use client";

import type { ReactNode, Ref, RefObject } from "react";
// @ts-expect-error - nextjs types?
import { useRef, ViewTransition } from "react";

import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Divider,
  ScrollShadow,
} from "@heroui/react";
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
    return <InlineTOC items={content.toc} />;
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
              className="text-sm transition-colors dark:text-gray-400 text-gray-500 [&[data-active='true']]:text-black dark:[&[data-active='true']]:text-white">
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
      <div className="[&>*]:w-full mb-14 w-full">
        <MDXInlineTOC />
      </div>
      <div
        className="flex w-full relative prose-code:text-[13px] prose-code:font-normal"
        ref={containerRef}>
        {props.children}
        <Card className="hidden lg:flex w-[30%] not-prose sticky top-24 h-fit ml-2">
          <CardHeader>
            {content.tocContents?.label ?? "On this page"}
          </CardHeader>
          <ScrollShadow className="w-full max-h-[300px]">
            <CardBody className="pl-0 pt-0 gap-1">
              <MDXTableOfContents containerRef={containerRef} />
            </CardBody>
          </ScrollShadow>
          <Divider />
          {props.updatedAt ? (
            <CardFooter>
              <span className="self-start text-sm flex gap-1 items-center">
                {content.tocContents?.updated ?? "Last updated"}:{" "}
                <ViewTransition>
                  <DateFormat
                    date={props.updatedAt}
                    format="YYYY-MM-DD HH:mm"
                    locale={props.locale}
                  />
                </ViewTransition>
                <span className="i-mdi-pencil" />
              </span>
            </CardFooter>
          ) : null}
        </Card>
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
