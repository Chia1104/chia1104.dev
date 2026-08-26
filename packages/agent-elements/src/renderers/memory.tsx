"use client";

import { Brain, ExternalLink } from "lucide-react";
import * as z from "zod";

import { TOOL_NAMES } from "@chia/agent-writing/tools/registry";

import { DefaultToolBody } from "../tool-call.tsx";
import type { ToolRenderer, ToolRenderers } from "../tool-call.tsx";

/** Only web URLs reach an `href`; a model-chosen `javascript:` or `file:` never does. */
const httpUrl = z.url({ protocol: /^https?$/ });

const memorySummary = z.object({
  id: z.number(),
  kind: z.string(),
  title: z.string(),
  sourceUrl: httpUrl.nullable().optional(),
});

const searchDetails = z.object({
  query: z.string().optional(),
  hits: z.array(memorySummary.extend({ snippet: z.string().optional() })),
});

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const Memory = ({
  id,
  kind,
  snippet,
  sourceUrl,
  title,
}: z.infer<typeof memorySummary> & { snippet?: string }) => (
  <li className="flex flex-col gap-0.5">
    <div className="text-foreground flex items-baseline gap-2 text-sm">
      <Brain className="text-muted size-3.5 shrink-0 self-center" />
      <span className="text-muted shrink-0 font-mono text-xs">
        {kind} #{id}
      </span>
      <span className="truncate">{title}</span>
      {sourceUrl ? (
        <a
          className="text-muted hover:text-accent flex shrink-0 items-center gap-1 text-xs"
          href={sourceUrl}
          rel="noreferrer noopener"
          target="_blank">
          {hostOf(sourceUrl)}
          <ExternalLink className="size-3" />
        </a>
      ) : null}
    </div>
    {snippet ? (
      <p className="text-muted line-clamp-2 pl-5.5 text-xs leading-relaxed">
        {snippet}
      </p>
    ) : null}
  </li>
);

const SearchMemory: ToolRenderer = ({ tool }) => {
  const parsed = searchDetails.safeParse(tool.details);
  if (!parsed.success) return <DefaultToolBody tool={tool} />;
  if (parsed.data.hits.length === 0) {
    return <p className="text-muted text-xs">{tool.summary}</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {parsed.data.hits.map((hit) => (
        <Memory key={hit.id} {...hit} />
      ))}
    </ul>
  );
};

const OneMemory: ToolRenderer = ({ tool }) => {
  const parsed = memorySummary.safeParse(tool.details);
  if (!parsed.success) return <DefaultToolBody tool={tool} />;
  return (
    <ul>
      <Memory {...parsed.data} />
    </ul>
  );
};

export const memoryToolRenderers: ToolRenderers = {
  [TOOL_NAMES.searchMemory]: SearchMemory,
  [TOOL_NAMES.getMemory]: OneMemory,
  [TOOL_NAMES.saveMemory]: OneMemory,
};
