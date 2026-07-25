/**
 * Domain events emitted by oRPC handlers.
 *
 * These used to travel on the request context (`context.hooks.onFeedChanged`), which
 * meant every service app's context type carried the content domain's indexing
 * dependency. They are now registered once per process by the app that owns the
 * side effect; apps that do not register a listener simply emit nothing.
 */
export interface FeedEventListeners {
  onFeedChanged?: (feedID: number) => Promise<void>;
  onFeedRemoved?: (translationIDs: readonly number[]) => Promise<void>;
}

let listeners: FeedEventListeners = {};

export const registerFeedEventListeners = (next: FeedEventListeners): void => {
  listeners = { ...listeners, ...next };
};

/** Test helper — drops every registered listener. */
export const resetFeedEventListeners = (): void => {
  listeners = {};
};

export const feedEvents = {
  async changed(feedID: number): Promise<void> {
    await listeners.onFeedChanged?.(feedID);
  },
  async removed(translationIDs: readonly number[]): Promise<void> {
    await listeners.onFeedRemoved?.(translationIDs);
  },
};
