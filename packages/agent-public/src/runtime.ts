import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type {
  ContentReadPort,
  ProfileReadPort,
} from "@chia/agent-content/types";
import { createAgentModels, NO_ACCESS } from "@chia/agent-runtime/models";
import type {
  AgentModelAccess,
  AgentModelRef,
} from "@chia/agent-runtime/models";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import { runPiTurn } from "@chia/agent-runtime/pi/turn";
import type { RenderedAttachments } from "@chia/agent-runtime/pi/turn";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentSessionSettings,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentUsageListener,
} from "@chia/agent-runtime/types";
import type {
  AgentAttachment,
  AgentWireEvent,
} from "@chia/agent-runtime/wire/schema";
import { Locale } from "@chia/db/types";

import { resolvePublicModel } from "./models.ts";
import { publicPolicy, publicTurnBudget } from "./policy.ts";
import { renderProfileBrief } from "./prompts/profile.ts";
import { buildSystemPrompt, buildTurnContext } from "./prompts/system.ts";
import { createPublicTools } from "./tools/tool-set.ts";
import type { PublicToolContext } from "./types.ts";

export interface RunPublicTurnOptions<TApproval> {
  session: SessionTree;
  settings: AgentSessionSettings;
  agentSessionId: string;
  agentRunId?: string;
  /** Built by the host with `public` visibility; the tools cannot widen it. */
  content: ContentReadPort;
  /** Published rows only; rendered into the system prompt once per turn. */
  profile: ProfileReadPort;
  instructions?: string;
  message: AgentTurnMessage;
  onEvent: (event: AgentWireEvent) => void;
  approvedApprovalKeys?: ReadonlySet<string>;
  consumeApproval?: (key: string) => Promise<void>;
  signal?: AbortSignal;
  models?: Models;
  /** Keys the caller holds; must match how `models` was built. */
  access?: AgentModelAccess;
  /** The operator-pinned house model; the only one a keyless visitor may run. */
  house?: AgentModelRef;
  compactionModel?: Model<Api>;
  defaultLocale?: Locale;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApproval: (approval: TApproval) => Promise<void>;
  flushEvents?: () => Promise<void>;
  onUsage?: AgentUsageListener;
}

/** Quoted as a fenced block so the passage reads as the visitor's citation, not their words. */
const quoted = (text: string): string => `"""\n${text}\n"""`;

/** The published post and its translation for `locale`, or `null` when the port cannot see it. */
const readPost = async (
  content: ContentReadPort,
  feedId: number,
  localeName: string
) => {
  const locale = Object.values(Locale).find((value) => value === localeName);
  const post = await content.getPost({ feedId, locale });
  const translation =
    post?.translations.find((entry) => entry.locale === localeName) ??
    post?.translations[0];
  return post && translation ? { post, translation } : null;
};

/**
 * The block the model reads ahead of the visitor's words. Only a published post is readable:
 * the one being read, or a selection from one. The port decides what is published, so an
 * unreadable id is named and skipped.
 */
const renderAttachments = async (
  content: ContentReadPort,
  attachments: readonly AgentAttachment[]
): Promise<RenderedAttachments> => {
  const rendered = await Promise.all(
    attachments.map(async (attachment) => {
      if (attachment.type === "feed") {
        const read = await readPost(content, attachment.id, attachment.locale);
        if (!read) {
          return {
            text: `- A post this agent cannot read; ignore it.`,
            label: `Post #${attachment.id}`,
          };
        }
        return {
          text:
            `- The visitor is reading the post "${read.translation.title}" (slug \`${read.post.slug}\`, ` +
            `locale ${attachment.locale}). A question with no other subject is about this post; ` +
            `\`get_post\` it before answering.`,
          label: read.translation.title,
        };
      }
      if (
        attachment.type !== "selection" ||
        attachment.source.type !== "feed"
      ) {
        return {
          text: `- An attachment this agent cannot read; ignore it.`,
          label: "Attachment",
        };
      }
      const { source, text } = attachment;
      const read = await readPost(content, source.id, source.locale);
      if (!read) {
        return {
          text: `- Selected text from a post this agent cannot read; ignore it.`,
          label: "Selection",
        };
      }
      const where = source.headingPath ? `, under "${source.headingPath}"` : "";
      return {
        text:
          `- Selected in the post "${read.translation.title}" (slug \`${read.post.slug}\`, locale ${source.locale}${where}):\n` +
          quoted(text),
        label: source.headingPath
          ? `${read.translation.title} · ${source.headingPath}`
          : read.translation.title,
      };
    })
  );
  return {
    text: `The visitor attached:\n${rendered.map((entry) => entry.text).join("\n")}`,
    attachments: attachments.map((attachment, index) => ({
      ...attachment,
      label: rendered[index]?.label,
    })),
  };
};

export const runPublicTurn = async <TApproval>(
  options: RunPublicTurnOptions<TApproval>
): Promise<AgentTurnExecution<TApproval>> => {
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;
  const models = options.models ?? createAgentModels();
  const toolContext: PublicToolContext = { content: options.content };
  // the allowlist check precedes any read, so a refused model costs no query
  const model = resolvePublicModel(
    options.settings,
    models,
    options.access ?? NO_ACCESS,
    options.house
  );
  const profile = renderProfileBrief(await options.profile.listPublished(), {
    locale: defaultLocale,
  });

  return runPiTurn({
    agentSessionId: options.agentSessionId,
    agentRunId: options.agentRunId,
    session: options.session,
    settings: options.settings,
    model,
    models,
    compactionModel: options.compactionModel,
    tools: createPublicTools(),
    toolContext,
    systemPrompt: buildSystemPrompt({
      instructions: options.instructions,
      profile,
    }),
    volatileContext: () => buildTurnContext({ defaultLocale, now: new Date() }),
    renderAttachments: (attachments) =>
      renderAttachments(options.content, attachments),
    signal: options.signal,
    policy: publicPolicy,
    budget: publicTurnBudget,
    approvedApprovalKeys: options.approvedApprovalKeys,
    consumeApproval: options.consumeApproval,
    message: options.message,
    onEvent: options.onEvent,
    toApproval: options.toApproval,
    persistApproval: options.persistApproval,
    flushEvents: options.flushEvents,
    onUsage: options.onUsage,
  });
};
