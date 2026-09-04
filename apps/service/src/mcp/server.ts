import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ORPCError } from "@orpc/server";
import type { RouterClient } from "@orpc/server";
import * as z from "zod";

import type { router } from "@chia/api/orpc/router";
import { FeedType, Locale } from "@chia/db/types";

/**
 * Every tool is an adapter over an oRPC procedure; guards, errors and hooks run inside the
 * procedure. Content writes go through the shared working draft, the same one the dashboard
 * editor and the writing agent use; only `set_published` touches the feed directly. Writing is
 * fire-and-forget: the turn is durable in `apps/workflow`, so the tool returns as soon as the
 * run has started and review happens in dash.
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

const translationPatchSchema = z.object({
  title: z.string().min(1).optional(),
  excerpt: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  content: z.string().nullable().optional().describe("MDX body"),
});

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
        "List the site's posts and notes, unpublished included, newest first. Returns ids and titles; use get_post for the body.",
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
        "Read one post as published or last applied, with every translation and its MDX body. Pending draft edits are in get_draft.",
      inputSchema: { feedId: z.number().int() },
      annotations: { readOnlyHint: true },
    },
    guarded(({ feedId }) =>
      api.feeds["details-by-id"]({ feedId, includeUnpublished: true })
    )
  );

  server.registerTool(
    "list_drafts",
    {
      title: "List open drafts",
      description:
        "Drafts with unapplied work: new posts not yet applied, and posts edited since their last apply.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    guarded(() => api.feeds["draft:list"]())
  );

  server.registerTool(
    "open_draft",
    {
      title: "Open a draft",
      description:
        "Open a post's working draft (creating it from the post when there is none), or start an empty draft for a new post when feedId is omitted. Returns the draft with its revision.",
      inputSchema: {
        feedId: z.number().int().optional(),
      },
    },
    guarded(({ feedId }) => api.feeds["draft:open"]({ feedId }))
  );

  server.registerTool(
    "get_draft",
    {
      title: "Get a draft",
      description:
        "Read a working draft with every translation and its MDX body.",
      inputSchema: { draftId: z.number().int() },
      annotations: { readOnlyHint: true },
    },
    guarded(({ draftId }) => api.feeds["draft:get"]({ draftId }))
  );

  server.registerTool(
    "update_draft",
    {
      title: "Update a draft",
      description:
        "Change a draft's metadata or any translation. Only the fields given are written; pass null to clear one. Fails with CONFLICT when the draft moved past expectedRevision; read it again and retry.",
      inputSchema: {
        draftId: z.number().int(),
        expectedRevision: z
          .number()
          .int()
          .optional()
          .describe(
            "The revision you last read; omit to write over whatever is current"
          ),
        slug: z.string().min(1).optional(),
        type: postTypeSchema.optional(),
        defaultLocale: localeSchema.optional(),
        mainImage: z.string().url().nullable().optional(),
        translations: z
          .partialRecord(localeSchema, translationPatchSchema)
          .optional(),
      },
    },
    guarded((input) => api.feeds["draft:patch"](input))
  );

  server.registerTool(
    "apply_draft",
    {
      title: "Apply a draft to its post",
      description:
        "Write the draft to the database, creating an UNPUBLISHED post the first time. This does not publish; use set_published.",
      inputSchema: { draftId: z.number().int() },
    },
    guarded(({ draftId }) => api.feeds["draft:apply"]({ draftId }))
  );

  server.registerTool(
    "set_published",
    {
      title: "Publish or unpublish a post",
      description:
        "Flip a post's visibility on the site. Apply the draft first; publishing does not apply pending draft edits.",
      inputSchema: { feedId: z.number().int(), published: z.boolean() },
    },
    guarded(async ({ feedId, published }) => {
      await api.feeds.update({ feedId, published });
      return { feedId, published };
    })
  );

  server.registerTool(
    "write_post",
    {
      title: "Ask the writing agent to draft a post",
      description:
        "Start a writing-agent session and send it one prompt. Returns at once with the session id and a dash link; the agent keeps working there on the shared draft. Give it the material and what you want: the problem, what you tried, the fix, the audience and the language.",
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
          .describe(
            "Edit this existing post's draft instead of starting a new one"
          ),
        draftId: z
          .number()
          .int()
          .optional()
          .describe("Continue an existing draft, e.g. one from open_draft"),
      },
    },
    guarded(async ({ prompt, title, targetFeedId, draftId }) => {
      const detail = await api.agent.sessions.create({
        kind: WRITING_KIND,
        title,
        targetFeedId,
        draftId,
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
        draftId: detail.draft?.id ?? null,
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
