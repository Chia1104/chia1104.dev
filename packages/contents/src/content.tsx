"use client";

import { ViewTransition } from "react";

import DateFormat from "@chia/ui/date-format";

import { ContentContext } from "./content.context";
import { FloatingTOC } from "./floating-toc";
import type { ContentContextProps } from "./types";

const Content = (props: ContentContextProps) => (
  <ContentContext value={props}>
    <div className="prose-code:text-[13px] prose-code:font-normal w-full min-w-0 [&_img]:mx-auto [&_img]:max-w-165">
      {props.slot?.actions}
      {props.children}
      <FloatingTOC toc={props.toc} label={props.tocContents?.label} />
      {props.updatedAt ? (
        <footer className="not-prose border-border mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t pt-4">
          {props.updatedAt ? (
            <span className="text-muted text-xs tabular-nums">
              {props.tocContents?.updated ?? "Last updated"}{" "}
              <ViewTransition>
                <DateFormat
                  date={props.updatedAt}
                  format="YYYY/MM/DD"
                  locale={props.locale}
                />
              </ViewTransition>
            </span>
          ) : null}
        </footer>
      ) : null}
    </div>
  </ContentContext>
);

export default Content;
