import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ORPCError } from "@orpc/server";
import type { RouterClient } from "@orpc/server";
import * as z from "zod";

import type { router } from "@chia/api/orpc/router";
import { ContentType, FeedType, Locale } from "@chia/db/types";

/**
 * Every tool is an adapter over an oRPC procedure; guards, errors and hooks run inside the
 * procedure. Writing is fire-and-forget: the turn is durable in `apps/workflow`, so the tool
 * returns as soon as the run has started and review happens in dash.
 */

export type McpApi = RouterClient<typeof router>;

export interface McpServerOptions {
  api: McpApi;
  /** Where `write_post` points the operator to review the session. */
  dashBaseUrl: string;
}

const WRITING_KIND = "writing";

const localeSchema = z.enum(Locale);
const postTypeSchema = z.enum([FeedType.Post, FeedType.Note]);

const translationFields = {
  excerpt: z.string().optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional().describe("MDX body"),
};

interface TranslationInput {
  title?: string;
  excerpt?: string;
  description?: string;
  summary?: string;
  content?: string;
}

/** Contract translations nest the body under `content`; the tool takes it flat. */
const toTranslations = (
  translations: Partial<Record<Locale, TranslationInput>>
) =>
  Object.fromEntries(
    Object.entries(translations).map(([locale, { content, ...rest }]) => [
      locale,
      { ...rest, content: content === undefined ? undefined : { content } },
    ])
  );

/**
 * The procedure's result goes back as pretty JSON text. oRPC failures become tool errors the
 * model can read; anything else is a transport fault.
 */
const guarded =
  <TArgs, TResult>(run: (args: TArgs) => Promise<TResult>) =>
  async (args: TArgs): Promise<CallToolResult> => {
    try {
      const result = await run(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      if (error instanceof ORPCError) {
        return {
          isError: true,
          content: [{ type: "text", text: `${error.code}: ${error.message}` }],
        };
      }
      throw error;
    }
  };

export const createMcpServer = ({ api, dashBaseUrl }: McpServerOptions) => {
  const server = new McpServer({ name: "chia1104.dev", version: "1.0.0" });

  server.registerTool(
    "list_posts",
    {
      title: "List posts",
      description:
        "List the site's posts and notes, drafts included, newest first. Returns ids and titles; use get_post for the body.",
      inputSchema: {
        type: postTypeSchema.optional(),
        limit: z.number().int().min(1).max(50).optional(),
        cursor: z
          .string()
          .optional()
          .describe("nextCursor from a previous call"),
        locale: localeSchema.optional(),
      },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ type, limit, cursor, locale }) => {
      const page = await api.feeds.list({
        type,
        limit,
        nextCursor: cursor,
        locale,
        includeUnpublished: true,
      });
      return {
        items: page.items.map((feed) => ({
          id: feed.id,
          slug: feed.slug,
          type: feed.type,
          published: feed.published,
          defaultLocale: feed.defaultLocale,
          updatedAt: feed.updatedAt,
          translations: feed.translations.map((translation) => ({
            locale: translation.locale,
            title: translation.title,
            description: translation.description,
          })),
        })),
        nextCursor: page.nextCursor,
      };
    })
  );

  server.registerTool(
    "get_post",
    {
      title: "Get a post",
      description:
        "Read one post with every translation and its MDX body, published or not.",
      inputSchema: { feedId: z.number().int() },
      annotations: { readOnlyHint: true },
    },
    guarded(({ feedId }) =>
      api.feeds["details-by-id"]({ feedId, includeUnpublished: true })
    )
  );

  server.registerTool(
    "create_post",
    {
      title: "Create a post",
      description:
        "Create an unpublished post or note. The slug must be English/ASCII; the default locale needs a translation with a title.",
      inputSchema: {
        slug: z.string().min(1),
        type: postTypeSchema,
        defaultLocale: localeSchema.optional(),
        mainImage: z.string().url().optional(),
        translations: z.partialRecord(
          localeSchema,
          z.object({ title: z.string().min(1), ...translationFields })
        ),
      },
    },
    guarded(({ translations, ...meta }) =>
      api.feeds.create({
        ...meta,
        contentType: ContentType.Mdx,
        published: false,
        translations: toTranslations(translations),
      })
    )
  );

  server.registerTool(
    "update_post",
    {
      title: "Update a post",
      description:
        "Change a post's metadata or any translation. Only the fields given are written; `published` flips visibility on the site.",
      inputSchema: {
        feedId: z.number().int(),
        type: postTypeSchema.optional(),
        published: z.boolean().optional(),
        defaultLocale: localeSchema.optional(),
        mainImage: z.string().url().nullable().optional(),
        translations: z
          .partialRecord(
            localeSchema,
            z.object({
              title: z.string().min(1).optional(),
              ...translationFields,
            })
          )
          .optional(),
      },
    },
    guarded(async ({ translations, ...meta }) => {
      await api.feeds.update({
        ...meta,
        translations: translations && toTranslations(translations),
      });
      return { feedId: meta.feedId, updated: true };
    })
  );

  server.registerTool(
    "write_post",
    {
      title: "Ask the writing agent to draft a post",
      description:
        "Start a writing-agent session and send it one prompt. Returns at once with the session id and a dash link; the agent keeps working there. Give it the material and what you want: the problem, what you tried, the fix, the audience and the language.",
      inputSchema: {
        prompt: z.string().min(1),
        title: z
          .string()
          .max(200)
          .optional()
          .describe("Session title shown in dash"),
        targetFeedId: z
          .number()
          .int()
          .optional()
          .describe("Edit this existing post instead of starting a new draft"),
      },
    },
    guarded(async ({ prompt, title, targetFeedId }) => {
      const detail = await api.agent.sessions.create({
        kind: WRITING_KIND,
        title,
        targetFeedId,
      });
      const sessionId = detail.session.id;
      const events = await api.agent.sessions.chat({
        kind: WRITING_KIND,
        sessionId,
        action: { type: "prompt", text: prompt },
      });
      // The turn is durable once accepted; the first event proves it and the stream can go.
      await events.next();
      await events.return?.();
      return {
        sessionId,
        status: "running",
        reviewUrl: `${dashBaseUrl}/agent?session=${sessionId}`,
        next: "Call writing_status with this sessionId to read the draft, or open reviewUrl to approve and publish.",
      };
    })
  );

  server.registerTool(
    "writing_status",
    {
      title: "Check a writing session",
      description:
        "Where a writing-agent session stands: running, awaiting_approval, or idle once the turn is done, with its draft and the agent's last reply.",
      inputSchema: { sessionId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ sessionId }) => {
      const detail = await api.agent.sessions.get({
        kind: WRITING_KIND,
        sessionId,
      });
      const pendingApprovals = detail.approvals
        .filter((approval) => approval.status === "pending")
        .map(({ toolCallId, toolName }) => ({ toolCallId, toolName }));
      const lastReply =
        detail.events.findLast((event) => event.type === "assistant:end")
          ?.text ?? null;
      // A run parked on the message hook has finished its turn; only a running one is busy.
      const status =
        pendingApprovals.length > 0
          ? "awaiting_approval"
          : detail.run?.status === "running"
            ? "running"
            : "idle";
      return {
        sessionId,
        title: detail.session.title,
        status,
        pendingApprovals,
        draft: detail.draft ?? null,
        lastReply,
        reviewUrl: `${dashBaseUrl}/agent?session=${sessionId}`,
      };
    })
  );

  return server;
};
