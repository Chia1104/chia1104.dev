"use client";

import type { ReactNode } from "react";

import { Chip } from "@heroui/react";
import { FileText } from "lucide-react";
import * as z from "zod";

import { CONTENT_TOOL_NAMES } from "@chia/agent-content/tools/registry";

import { DefaultToolBody } from "../tool-call.tsx";
import type { ToolRenderer, ToolRenderers } from "../tool-call.tsx";

/**
 * Views over the content read tools' `details`. The wire clips long details in place, so every
 * schema is loose and optional-heavy; anything that fails to parse falls back to the JSON view.
 */

const hitSchema = z.object({
  slug: z.string(),
  locale: z.string(),
  title: z.string(),
  snippet: z.string().optional(),
  headingPath: z.string().optional(),
});

const searchDetails = z.object({ hits: z.array(hitSchema) });

const listItemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  type: z.string().optional(),
  published: z.boolean().optional(),
  updatedAt: z.string().optional(),
});

const listDetails = z.object({ posts: z.array(listItemSchema) });

const postDetails = z.object({
  post: z.object({
    slug: z.string(),
    published: z.boolean().optional(),
    tagSlugs: z.array(z.string()).optional(),
    translations: z.array(
      z.object({
        locale: z.string(),
        title: z.string(),
        detail: z.string().optional(),
        tokenCount: z.number().optional(),
      })
    ),
  }),
  contextTokens: z.number().optional(),
});

const tagsDetails = z.object({
  tags: z.array(
    z.object({
      slug: z.string(),
      names: z.record(z.string(), z.string()).optional(),
    })
  ),
});

const Row = ({
  children,
  meta,
  title,
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
}) => (
  <li className="flex flex-col gap-0.5">
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <FileText className="text-muted size-3.5 shrink-0 self-center" />
      <span className="text-foreground text-sm">{title}</span>
      {meta ? (
        <span className="text-muted text-xs whitespace-nowrap">{meta}</span>
      ) : null}
    </span>
    {children}
  </li>
);

const SearchPosts: ToolRenderer = ({ tool }) => {
  const parsed = searchDetails.safeParse(tool.details);
  if (!parsed.success) return <DefaultToolBody tool={tool} />;
  if (parsed.data.hits.length === 0) {
    return <p className="text-muted text-xs">{tool.summary}</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {parsed.data.hits.map((hit, index) => (
        <Row
          key={`${hit.slug}:${hit.locale}:${index}`}
          meta={[hit.locale, hit.headingPath].filter(Boolean).join(" · ")}
          title={hit.title}>
          {hit.snippet ? (
            <p className="text-muted line-clamp-2 pl-5.5 text-xs leading-relaxed">
              {hit.snippet}
            </p>
          ) : null}
        </Row>
      ))}
    </ul>
  );
};

const ListPosts: ToolRenderer = ({ tool }) => {
  const parsed = listDetails.safeParse(tool.details);
  if (!parsed.success) return <DefaultToolBody tool={tool} />;
  return (
    <ul className="flex flex-col gap-1.5">
      {parsed.data.posts.map((post) => (
        <Row
          key={post.slug}
          meta={[
            post.type,
            post.published === false ? "draft" : undefined,
            post.updatedAt?.slice(0, 10),
          ]
            .filter(Boolean)
            .join(" · ")}
          title={post.title}
        />
      ))}
    </ul>
  );
};

const GetPost: ToolRenderer = ({ tool }) => {
  const parsed = postDetails.safeParse(tool.details);
  if (!parsed.success) return <DefaultToolBody tool={tool} />;
  const { post, contextTokens } = parsed.data;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {post.translations.map((translation) => (
          <Row
            key={translation.locale}
            meta={[
              translation.locale,
              translation.detail,
              translation.tokenCount
                ? `${translation.tokenCount} tokens`
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ")}
            title={translation.title}
          />
        ))}
      </ul>
      <p className="text-muted font-mono text-[11px]">
        {post.slug}
        {contextTokens ? ` · ${contextTokens} tokens` : ""}
      </p>
    </div>
  );
};

const ListTags: ToolRenderer = ({ tool }) => {
  const parsed = tagsDetails.safeParse(tool.details);
  if (!parsed.success) return <DefaultToolBody tool={tool} />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {parsed.data.tags.map((tag) => (
        <Chip key={tag.slug} size="sm" variant="soft">
          <Chip.Label>
            {Object.values(tag.names ?? {})[0] ?? tag.slug}
          </Chip.Label>
        </Chip>
      ))}
    </div>
  );
};

export const contentToolRenderers: ToolRenderers = {
  [CONTENT_TOOL_NAMES.searchPosts]: SearchPosts,
  [CONTENT_TOOL_NAMES.getPost]: GetPost,
  [CONTENT_TOOL_NAMES.listPosts]: ListPosts,
  [CONTENT_TOOL_NAMES.listTags]: ListTags,
};
