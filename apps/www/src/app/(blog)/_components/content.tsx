"use client";

import type { ReactElement } from "react";
import { useRef } from "react";

import { Divider } from "@nextui-org/react";
import dayjs from "dayjs";
import type { TableOfContents } from "fumadocs-core/server";
import * as Base from "fumadocs-core/toc";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { DocsBody } from "fumadocs-ui/page";

import type { ContentType } from "@chia/db/types";
import { cn } from "@chia/ui";

interface BaseProps {
  className?: string;
  updatedAt?: Date | string | number;
}

type MDXProps = {
  toc: TableOfContents;
  content: ReactElement;
} & BaseProps;

export type Props = BaseProps &
  (
    | {
        type: typeof ContentType.Mdx;
        toc: TableOfContents;
        content: ReactElement;
      }
    | {
        type: typeof ContentType.Tiptap;
        content?: string | null;
      }
    | {
        type: typeof ContentType.Plate;
        content?: string | null;
      }
    | {
        type: typeof ContentType.Notion;
        content?: string | null;
      }
  );

const MdxContent = (props: MDXProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div className="w-full">
      <div className="[&>*]:w-full mb-14 w-full">
        <InlineTOC items={props.toc} />
      </div>
      <div className="flex w-full relative" ref={containerRef}>
        <DocsBody
          className={cn(
            props.className,
            "prose dark:prose-invert w-full min-w-full lg:w-[70%] lg:min-w-[70%] prose-a:no-underline"
          )}>
          {props.content}
        </DocsBody>
        <div className="hidden lg:flex w-[30%] not-prose sticky top-24 h-fit gap-2 flex-col pl-5">
          <span>On this page</span>
          <Base.AnchorProvider toc={props.toc} single={false}>
            <Base.ScrollProvider containerRef={containerRef}>
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
          {props.updatedAt ? (
            <>
              <Divider className="mb-3" />
              <span className="self-start text-sm flex gap-1 items-center">
                Last updated:{" "}
                {dayjs(props.updatedAt).format("YYYY-MM-DD HH:mm")}
                <span className="i-mdi-pencil" />
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
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
