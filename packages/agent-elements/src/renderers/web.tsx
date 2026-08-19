"use client";

import { ExternalLink, Globe } from "lucide-react";
import * as z from "zod";

import { TOOL_NAMES } from "@chia/agent-writing/tools/registry";

import { useAgentLabels } from "../provider.tsx";
import { DefaultToolBody } from "../tool-call.tsx";
import type { ToolRenderer, ToolRenderers } from "../tool-call.tsx";

/** Only web URLs reach an `href`; a model-chosen `javascript:` or `file:` never does. */
const httpUrl = z.url({ protocol: /^https?$/ });

const searchDetails = z.object({
  query: z.string().optional(),
  results: z.array(
    z.object({
      url: httpUrl,
      title: z.string().optional(),
      description: z.string().optional(),
    })
  ),
});

const pageDetails = z.object({
  url: httpUrl,
  title: z.string().optional(),
  truncated: z.boolean().optional(),
});

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const Source = ({
  description,
  title,
  url,
}: {
  url: string;
  title?: string;
  description?: string;
}) => (
  <li className="flex flex-col gap-0.5">
    <a
      className="text-foreground hover:text-accent flex items-baseline gap-2 text-sm"
      href={url}
      rel="noreferrer noopener"
      target="_blank">
      <Globe className="text-muted size-3.5 shrink-0 self-center" />
      <span className="truncate">{title ?? url}</span>
      <span className="text-muted shrink-0 text-xs">{hostOf(url)}</span>
      <ExternalLink className="text-muted size-3 shrink-0 self-center" />
    </a>
    {description ? (
      <p className="text-muted line-clamp-2 pl-5.5 text-xs leading-relaxed">
        {description}
      </p>
    ) : null}
  </li>
);

const WebSearch: ToolRenderer = ({ tool }) => {
  const parsed = searchDetails.safeParse(tool.details);
  if (!parsed.success) return <DefaultToolBody tool={tool} />;
  if (parsed.data.results.length === 0) {
    return <p className="text-muted text-xs">{tool.summary}</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {parsed.data.results.map((result, index) => (
        <Source key={`${result.url}:${index}`} {...result} />
      ))}
    </ul>
  );
};

const FetchUrl: ToolRenderer = ({ tool }) => {
  const labels = useAgentLabels();
  const parsed = pageDetails.safeParse(tool.details);
  if (!parsed.success) return <DefaultToolBody tool={tool} />;
  return (
    <ul>
      <Source
        description={parsed.data.truncated ? labels.truncated : undefined}
        title={parsed.data.title}
        url={parsed.data.url}
      />
    </ul>
  );
};

export const webToolRenderers: ToolRenderers = {
  [TOOL_NAMES.webSearch]: WebSearch,
  [TOOL_NAMES.fetchUrl]: FetchUrl,
};
