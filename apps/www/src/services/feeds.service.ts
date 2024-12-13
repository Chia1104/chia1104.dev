import { captureException } from "@sentry/nextjs";
import { HTTPError } from "ky";
import "server-only";

import {
  getFeedBySlug,
  getFeedsWithMetaByAdminId,
} from "@chia/api/services/feeds";

import { env } from "@/env";

export const FEEDS_CACHE_TAGS = {
  getPosts: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getPosts",
    limit.toString(),
  ],
  getPostBySlug: (slug: string) => ["ADMIN_FEEDS_ISR", "getPostBySlug", slug],
  getNotes: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getNotes",
    limit.toString(),
  ],
  getNoteBySlug: (slug: string) => ["ADMIN_FEEDS_ISR", "getNoteBySlug", slug],
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

export const getPostBySlug = async (slug: string) => {
  try {
    return await getFeedBySlug(env.INTERNAL_REQUEST_SECRET, { slug });
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

export const getNoteBySlug = async (slug: string) => {
  try {
    return await getFeedBySlug(env.INTERNAL_REQUEST_SECRET, { slug });
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 404) {
      return null;
    }
    captureException(error);
    throw error;
  }
};
