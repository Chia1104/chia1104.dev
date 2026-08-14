import { describe, expect, it } from "vitest";

import type { Session } from "@chia/auth/types";
import type { Caller } from "@chia/service-kit/policies";
import { CallerTier } from "@chia/service-kit/policies";

import { resolveFeedLimit, resolveFeedVisibility } from "../feeds/access";

const ADMIN_ID = "admin-1";

const session = (userId: string) =>
  ({ user: { id: userId } }) as unknown as Session;

const caller = (tier: CallerTier, userId?: string): Caller => ({
  tier,
  adminId: ADMIN_ID,
  session: userId ? session(userId) : undefined,
});

/**
 * The published/deleted filters used to be structural — each audience had its own
 * procedure whose input schema had no way to spell "show me drafts". Merging them makes
 * the rule a runtime decision, so these cases are what keeps it honest.
 */
describe("resolveFeedVisibility", () => {
  it("pins an anonymous caller to the admin's published feeds", () => {
    expect(resolveFeedVisibility(caller(CallerTier.Anonymous))).toEqual({
      userId: ADMIN_ID,
      published: true,
      enableDeleted: false,
    });
  });

  it("ignores an anonymous caller's request for drafts and deleted feeds", () => {
    expect(
      resolveFeedVisibility(caller(CallerTier.Anonymous), {
        includeUnpublished: true,
        includeDeleted: true,
      })
    ).toEqual({ userId: ADMIN_ID, published: true, enableDeleted: false });
  });

  it("keeps an API-key caller on published feeds unless it asks otherwise", () => {
    expect(resolveFeedVisibility(caller(CallerTier.ApiKey))).toEqual({
      userId: ADMIN_ID,
      published: true,
      enableDeleted: false,
    });
  });

  it("grants drafts — but not deleted feeds — to an API-key caller that asks", () => {
    expect(
      resolveFeedVisibility(caller(CallerTier.ApiKey), {
        includeUnpublished: true,
        includeDeleted: true,
      })
    ).toEqual({ userId: ADMIN_ID, published: undefined, enableDeleted: false });
  });

  it("scopes a session to its own feeds and grants both flags", () => {
    expect(
      resolveFeedVisibility(caller(CallerTier.Session, "user-2"), {
        includeUnpublished: true,
        includeDeleted: true,
      })
    ).toEqual({
      userId: "user-2",
      published: undefined,
      enableDeleted: true,
    });
  });

  it("still defaults a session to published, non-deleted feeds", () => {
    expect(resolveFeedVisibility(caller(CallerTier.Session, "user-2"))).toEqual(
      {
        userId: "user-2",
        published: true,
        enableDeleted: false,
      }
    );
  });

  it("scopes root to its own feeds with both flags available", () => {
    expect(
      resolveFeedVisibility(caller(CallerTier.Root, ADMIN_ID), {
        includeUnpublished: true,
        includeDeleted: true,
      })
    ).toEqual({
      userId: ADMIN_ID,
      published: undefined,
      enableDeleted: true,
    });
  });

  it("falls back to the admin id when a session tier carries no session", () => {
    expect(resolveFeedVisibility(caller(CallerTier.Session))).toEqual({
      userId: ADMIN_ID,
      published: true,
      enableDeleted: false,
    });
  });
});

describe("resolveFeedLimit", () => {
  it("caps an anonymous page at 50", () => {
    expect(resolveFeedLimit(CallerTier.Anonymous, 1000)).toBe(50);
  });

  it("lets the sitemap's API-key call through at 1000", () => {
    expect(resolveFeedLimit(CallerTier.ApiKey, 1000)).toBe(1000);
  });

  it("never widens a smaller request", () => {
    expect(resolveFeedLimit(CallerTier.Root, 10)).toBe(10);
  });
});
