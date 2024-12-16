import { captureException } from "@sentry/nextjs";
import { HTTPError } from "ky";
import "server-only";

import {
  getFeedBySlug as _getFeedBySlug,
  getFeedsWithMetaByAdminId,
} from "@chia/api/services/feeds";

import { env } from "@/env";

export const FEEDS_CACHE_TAGS = {
  getPosts: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getPosts",
    limit.toString(),
  ],
  /**
   * @deprecated use `getFeedBySlug` instead
   */
  getPostBySlug: (slug: string) => ["ADMIN_FEEDS_ISR", "getPostBySlug", slug],
  getNotes: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getNotes",
    limit.toString(),
  ],
  /**
   * @deprecated use `getFeedBySlug` instead
   */
  getNoteBySlug: (slug: string) => ["ADMIN_FEEDS_ISR", "getNoteBySlug", slug],
  getFeedBySlug: (slug: string) => ["ADMIN_FEEDS_ISR", "getFeedBySlug", slug],
};

export const getPosts = async (limit = 10) => {
  try {
    return await getFeedsWithMetaByAdminId(env.INTERNAL_REQUEST_SECRET, {
      limit,
      type: "post",
      published: "true",
      orderBy: "id",
      sortOrder: "desc",
      withContent: "false",
    });
  } catch (error) {
    captureException(error);
    throw error;
  }
};

/**
 * @deprecated use `getFeedBySlug` instead
 */
export const getPostBySlug = async (slug: string) => {
  try {
    return await _getFeedBySlug(env.INTERNAL_REQUEST_SECRET, { slug });
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 404) {
      return null;
    }
    captureException(error);
    throw error;
  }
};

export const getNotes = async (limit = 10) => {
  try {
    return await getFeedsWithMetaByAdminId(env.INTERNAL_REQUEST_SECRET, {
      limit,
      type: "note",
      published: "true",
      orderBy: "id",
      sortOrder: "desc",
      withContent: "false",
    });
  } catch (error) {
    captureException(error);
    throw error;
  }
};

/**
 * @deprecated use `getFeedBySlug` instead
 */
export const getNoteBySlug = async (slug: string) => {
  try {
    return await _getFeedBySlug(env.INTERNAL_REQUEST_SECRET, { slug });
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 404) {
      return null;
    }
    captureException(error);
    throw error;
  }
};

export const getFeedBySlug = async (slug: string) => {
  try {
    return await _getFeedBySlug(env.INTERNAL_REQUEST_SECRET, { slug });
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 404) {
      return null;
    }
    captureException(error);
    throw error;
  }
};
