"use client";

import type { ReactNode, Ref, RefObject } from "react";
import { useRef } from "react";

import dayjs from "dayjs";
import tz from "dayjs/plugin/timezone";
import * as Base from "fumadocs-core/toc";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { DocsBody } from "fumadocs-ui/page";

import { ContentType } from "@chia/db/types";
import { cn } from "@chia/ui";

import type { ContentProps } from "./types";

dayjs.extend(tz);

/**
 * @deprecated remove context
 */
export const ContentProvider = ({
  children,
}: ContentProps & { children?: ReactNode }) => {
  return children;
};

export const MDXInlineTOC = (props: ContentProps) => {
  if (props.type === ContentType.Mdx) {
    return <InlineTOC items={props.toc} />;
  }
  return null;
};

export const MDXBody = (props: { className?: string } & ContentProps) => {
  if (props.type === ContentType.Mdx) {
    return (
      <DocsBody
        className={cn(
          props.className,
          "prose dark:prose-invert w-full min-w-full lg:w-[70%] lg:min-w-[70%]"
        )}>
        {props.content}
      </DocsBody>
    );
  }
  return null;
};

export const MDXTableOfContents = <TContainer extends HTMLElement>(
  props: {
    containerRef: Ref<TContainer>;
  } & ContentProps
) => {
  if (props.type === ContentType.Mdx) {
    return (
      <Base.AnchorProvider toc={props.toc} single={false}>
        <Base.ScrollProvider
          containerRef={props.containerRef as RefObject<TContainer>}>
          {props.toc.map((item) => (
            <Base.TOCItem
              key={item.url}
              href={item.url}
              className="text-sm transition-colors dark:text-gray-400 text-gray-500 [&[data-active='true']]:text-black dark:[&[data-active='true']]:text-white"
              style={{
                paddingLeft: `${item.depth * 0.5}rem`,
              }}>
              {item.title}
            </Base.TOCItem>
          ))}
        </Base.ScrollProvider>
      </Base.AnchorProvider>
    );
  }
  return null;
};

export const MdxContent = (props: ContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div className="w-full">
      <div className="[&>*]:w-full mb-14 w-full">
        <MDXInlineTOC {...props} />
      </div>
      <div className="flex w-full relative" ref={containerRef}>
        <MDXBody {...props} className={props.className} />
        <div className="hidden lg:flex w-[30%] not-prose sticky top-24 h-fit gap-2 flex-col pl-5">
          <span>On this page</span>
          <MDXTableOfContents {...props} containerRef={containerRef} />
          <hr className="border-gray-500 dark:border-gray-400" />
          {/* TODO: i18n */}
          {props.updatedAt ? (
            <>
              <span className="self-start text-sm flex gap-1 items-center">
                Last updated:{" "}
                {dayjs(props.updatedAt).tz("UTC").format("YYYY-MM-DD HH:mm")}
                <span className="i-mdi-pencil" />
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const Content = (props: ContentProps) => {
  switch (props.type) {
    case "mdx": {
      return <MdxContent {...props} />;
    }
    default:
      return null;
  }
};
