import type { AgentAttachmentInput } from "@chia/agent-runtime/wire/schema";

/** djb2 over the text; two selections of the same passage collapse into one row. */
const hashOf = (text: string): string => {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
};

/** Identity of an attachment on the client: what dedupes a prompt and keys a context row. */
export const attachmentKeyOf = (attachment: AgentAttachmentInput): string => {
  if (attachment.type === "draft") return `draft:${attachment.id}`;
  if (attachment.type === "feed")
    return `feed:${attachment.id}:${attachment.locale}`;
  const { source } = attachment;
  const where =
    source.type === "draft"
      ? `${source.locale}:${source.startLine}-${source.endLine}`
      : `${source.locale}:${source.headingPath ?? ""}`;
  return `selection:${source.type}:${source.id}:${where}:${hashOf(attachment.text)}`;
};

/** The attachment as the wire takes it: without any client-side decoration. */
export const attachmentInputOf = (
  attachment: AgentAttachmentInput
): AgentAttachmentInput =>
  attachment.type === "draft"
    ? { type: "draft", id: attachment.id }
    : attachment.type === "feed"
      ? { type: "feed", id: attachment.id, locale: attachment.locale }
      : {
          type: "selection",
          text: attachment.text,
          source: attachment.source,
        };

/** The short tag beside an attachment's label: the record id, or where the selection sits. */
export const attachmentMetaOf = (attachment: AgentAttachmentInput): string => {
  if (attachment.type !== "selection") return `#${attachment.id}`;
  const { source } = attachment;
  if (source.type === "draft") {
    return source.startLine === source.endLine
      ? `L${source.startLine}`
      : `L${source.startLine}–${source.endLine}`;
  }
  return source.headingPath ?? `#${source.id}`;
};
