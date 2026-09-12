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
        "Drafts with unapplied work: new posts not yet applied, and posts edited since their last apply. Returns ids, titles and revisions; use get_draft for the body.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    guarded(() => api.feeds["draft:list"]())
  );

  server.registerTool(
    "discard_draft",
    {
      title: "Discard a draft",
      description:
        "Drop a draft's unapplied work. A post's draft goes back to what the post holds; a new post's draft is deleted with its revisions.",
      inputSchema: { draftId: z.number().int() },
      annotations: { destructiveHint: true },
    },
    guarded(async ({ draftId }) => {
      await api.feeds["draft:discard"]({ draftId });
      return { draftId, discarded: true };
    })
  );

  server.registerTool(
    "list_draft_revisions",
    {
      title: "List a draft's revisions",
      description:
        "Restore points of a draft, newest first: who wrote each (operator or agent) and which fields changed. Pass a revision's id to restore_draft_revision.",
      inputSchema: {
        draftId: z.number().int(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    guarded(({ draftId, limit }) =>
      api.feeds["draft:revisions"]({ draftId, limit })
    )
  );

  server.registerTool(
    "restore_draft_revision",
    {
      title: "Restore a draft revision",
      description:
        "Put the draft back to the state a revision recorded, as a new revision on top. Nothing is lost: the state being replaced stays in the trail.",
      inputSchema: {
        draftId: z.number().int(),
        revisionId: z.number().int(),
      },
    },
    guarded(({ draftId, revisionId }) =>
      api.feeds["draft:restore"]({ draftId, revisionId })
    )
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
    "edit_draft",
    {
      title: "Edit a draft body in place",
      description:
        "Replace an exact string in one locale's MDX body without resending the rest. `oldString` must match the current body byte for byte, indentation included; a target that matches more than once fails unless replaceAll. Read the draft first with get_draft.",
      inputSchema: {
        draftId: z.number().int(),
        locale: localeSchema,
        oldString: z.string().min(1).describe("Exact existing text to replace"),
        newString: z
          .string()
          .describe("Replacement text; empty deletes the match"),
        replaceAll: z
          .boolean()
          .optional()
          .describe("Replace every match instead of failing on ambiguity"),
        expectedRevision: z
          .number()
          .int()
          .optional()
          .describe(
            "The revision you last read; omit to edit whatever is current"
          ),
      },
    },
    guarded((input) => api.feeds["draft:edit"](input))
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
            "Hand the agent this existing post's draft instead of letting it start a new one"
          ),
        draftId: z
          .number()
          .int()
          .optional()
          .describe(
            "Hand the agent an existing draft, e.g. one from open_draft"
          ),
      },
    },
    guarded(async ({ prompt, title, targetFeedId, draftId }) => {
      // The agent is not bound to a draft; a post or draft named here rides on the prompt.
      const attached =
        draftId ??
        (targetFeedId === undefined
          ? undefined
          : (await api.feeds["draft:open"]({ feedId: targetFeedId })).id);
      const detail = await api.agent.sessions.create({
        kind: WRITING_KIND,
        title,
      });
      const sessionId = detail.session.id;
      const events = await api.agent.sessions.chat({
        kind: WRITING_KIND,
        sessionId,
        action: {
          type: "prompt",
          text: prompt,
          attachments:
            attached === undefined
              ? undefined
              : [{ type: "draft", id: attached }],
        },
      });
      // The turn is durable once accepted; the first event proves it and the stream can go.
      await events.next();
      await events.return?.();
      return {
        sessionId,
        draftId: attached ?? null,
        status: "running",
        reviewUrl: `${dashBaseUrl}/feed/drafts?agent=open&session=${sessionId}`,
        next: "Call writing_status with this sessionId to read the draft, or open reviewUrl to approve and publish.",
      };
    })
  );

  server.registerTool(
    "writing_status",
    {
      title: "Check a writing session",
      description:
        "Where a writing-agent session stands: running, awaiting_approval, or idle once the turn is done, with the drafts it worked on and the agent's last reply.",
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
        drafts: detail.drafts ?? [],
        lastReply,
        reviewUrl: `${dashBaseUrl}/feed/drafts?agent=open&session=${sessionId}`,
      };
    })
  );

  return server;
};
