import { createContentReadTools } from "@chia/agent-content/tools/read";
import type {
  ContentReadPort,
  ProfileReadPort,
  WebPort,
} from "@chia/agent-content/types";
import type {
  AgentTurnPlan,
  RenderedAttachments,
} from "@chia/agent-runtime/pi/turn";
import type { AgentAttachment } from "@chia/agent-runtime/wire/schema";
import type { GuardProvider } from "@chia/ai/guard/provider";
import { Locale } from "@chia/db/types";

import { publicTurnBudget } from "./policy.ts";
import type { ReportPort } from "./ports.ts";
import { renderProfileBrief } from "./prompts/profile.ts";
import { buildSystemPrompt, buildTurnContext } from "./prompts/system.ts";
import { createMessageScreen } from "./screen.ts";
import { createPublicReportTools } from "./tools/report.tool.ts";
import { createPublicWebTools } from "./tools/web.tool.ts";

export interface PreparePublicTurnOptions {
  /** Built by the host with `public` visibility; the tools cannot widen it. */
  content: ContentReadPort;
  /** Published rows only; rendered into the system prompt once per turn. */
  profile: ProfileReadPort;
  instructions?: string;
  /** Grades the visitor's message before the model reads it; null when no guard is configured. */
  guard: GuardProvider | null;
  /** Granted by the host per turn. Ignored without a guard: web text must be checked. */
  web?: WebPort;
  /** Granted by the host when the session's owner is signed in. */
  report?: ReportPort;
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
            `locale ${attachment.locale}) at ${read.translation.url}. A question with no other ` +
            `subject is about this post; \`get_post\` it before answering.`,
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
          `- Selected in the post "${read.translation.title}" (slug \`${read.post.slug}\`, locale ${source.locale}${where}) at ${read.translation.url}:\n` +
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

/** The public kind's tools and prompts for one turn. */
export const preparePublicTurn = async (
  options: PreparePublicTurnOptions
): Promise<AgentTurnPlan> => {
  const profile = renderProfileBrief(await options.profile.listPublished(), {
    locale: Locale.ZhTW,
  });

  const webTools =
    options.web && options.guard
      ? createPublicWebTools({ web: options.web, guard: options.guard })
      : [];

  return {
    tools: [
      ...createContentReadTools({ content: options.content }),
      ...webTools,
      ...(options.report ? createPublicReportTools(options.report) : []),
    ],
    systemPrompt: buildSystemPrompt({
      instructions: options.instructions,
      profile,
      web: webTools.length > 0,
      report: options.report !== undefined,
    }),
    volatileContext: () =>
      buildTurnContext({ defaultLocale: Locale.ZhTW, now: new Date() }),
    renderAttachments: (attachments) =>
      renderAttachments(options.content, attachments),
    screen: options.guard ? createMessageScreen(options.guard) : undefined,
    budget: publicTurnBudget,
  };
};
