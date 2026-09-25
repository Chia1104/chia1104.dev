import type { MessageEntry, NewSessionEntry } from "../session/entries.ts";
import type { SessionTree } from "../session/tree.ts";
import { AgentErrorKind } from "../types.ts";
import type { AgentTurnError } from "../types.ts";
import type { AgentAttachment, AgentWireEvent } from "../wire/schema.ts";

/** A turn's writes to the session tree, each persisted before its events reach the wire. */
export interface TurnTranscript {
  /** The entry the next append hangs off. */
  readonly leafId: string | null;
  /** Set once the tree refused an entry: nothing after it may be persisted or shown. */
  readonly failed: boolean;
  /**
   * Appends a message under the leaf and only then emits `events`, so a client never sees a
   * message the tree lost. Resolves `false`, emitting nothing, once the tree has refused an entry.
   */
  append: (
    entry: {
      id: string;
      message: MessageEntry["message"];
      attachments?: AgentAttachment[];
    },
    events?: readonly AgentWireEvent[]
  ) => Promise<boolean>;
}

export const createTurnTranscript = async ({
  session,
  onEvent,
  fail,
}: {
  session: SessionTree;
  onEvent: (event: AgentWireEvent) => void;
  fail: (error: AgentTurnError, cause?: unknown) => void;
}): Promise<TurnTranscript> => {
  let leafId = await session.getLeafId();
  let failed = false;

  return {
    get leafId() {
      return leafId;
    },
    get failed() {
      return failed;
    },
    append: async ({ id, message, attachments }, events = []) => {
      if (failed) return false;
      const entry: NewSessionEntry<MessageEntry> = {
        type: "message",
        id,
        parentId: leafId,
        timestamp: Date.now(),
        message,
        ...(attachments && { attachments }),
      };
      try {
        await session.appendEntry(entry);
      } catch (error) {
        failed = true;
        fail(
          {
            kind: AgentErrorKind.Internal,
            message: `The session tree refused entry ${id}.`,
          },
          error
        );
        return false;
      }
      leafId = id;
      for (const event of events) onEvent(event);
      return true;
    },
  };
};
