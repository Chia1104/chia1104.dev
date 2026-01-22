import { oc } from "@orpc/contract";
import * as z from "zod";

import { locale } from "@chia/db";
import {
  infiniteSchema,
  feedSchema,
  feedTranslationSchema,
  contentSchema,
  insertFeedSchema,
  insertContentSchema,
} from "@chia/db/validator/feeds";

const dateSchema = z.object({
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

// ============================================
// Input Schemas
// ============================================

export const createFeedSchema = z.object({
  ...insertFeedSchema
    .omit({ userId: true, createdAt: true, updatedAt: true })
    .partial({ slug: true }).shape,
  translation: z.object({
    locale: z.enum(locale.enumValues),
    title: z.string().min(1),
    excerpt: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
    readTime: z.number().optional().nullable(),
  }),
  content: insertContentSchema.optional(),
  ...dateSchema.shape,
});

export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = z.object({
  feedId: z.number(),
  ...insertFeedSchema
    .omit({
      userId: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
    })
    .partial().shape,
  translation: z
    .object({
      locale: z.enum(locale.enumValues),
      title: z.string().min(1).optional(),
      excerpt: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      summary: z.string().optional().nullable(),
      readTime: z.number().optional().nullable(),
    })
    .optional(),
  content: z
    .object({
      content: z.string().optional().nullable(),
      source: z.string().optional().nullable(),
      unstableSerializedSource: z.string().optional().nullable(),
    })
    .optional(),
  ...dateSchema.shape,
});

export const upsertFeedTranslationSchema = z.object({
  feedId: z.number(),
  locale: z.enum(locale.enumValues),
  title: z.string().min(1).optional(),
  excerpt: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  readTime: z.number().optional().nullable(),
});

export const upsertContentSchema = z.object({
  feedTranslationId: z.number(),
  content: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  unstableSerializedSource: z.string().optional().nullable(),
});

export const deleteFeedSchema = z.object({
  feedId: z.number(),
});

export const getFeedBySlugSchema = z.object({
  slug: z.string(),
  locale: z.enum(locale.enumValues).optional(),
});

export const getFeedByIdSchema = z.object({
  feedId: z.number(),
  locale: z.enum(locale.enumValues).optional(),
});

// ============================================
// Output Schemas
// ============================================

const withMetaSchema = <Out, In>(schema: z.ZodType<Out, In>) =>
  z.object({
    items: z.array(schema),
    nextCursor: z.union([z.string(), z.number()]).nullable(),
  });

export const feedWithTranslationsSchema = z.object({
  ...feedSchema.shape,
  translations: z.array(
    z.object({
      ...feedTranslationSchema.omit({ createdAt: true, updatedAt: true }).shape,
      createdAt: z.string(),
      updatedAt: z.string(),
      content: contentSchema
        .omit({ createdAt: true, updatedAt: true })
        .extend({
          createdAt: z.string(),
          updatedAt: z.string(),
        })
        .nullable(),
    })
  ),
  feedsToTags: z
    .array(
      z.object({
        tag: z
          .object({
            id: z.number(),
            slug: z.string(),
            translations: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                locale: z.enum(locale.enumValues),
                description: z.string().nullable(),
              })
            ),
          })
          .nullable(),
      })
    )
    .optional(),
});

// ============================================
// Contracts
// ============================================

export const getFeedsWithMetaContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(infiniteSchema)
  .output(withMetaSchema(feedWithTranslationsSchema));

export const getFeedsWithMetaByAdminIdContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(infiniteSchema)
  .output(withMetaSchema(feedWithTranslationsSchema));

export const getFeedBySlugContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(getFeedBySlugSchema)
  .output(feedWithTranslationsSchema);

export const getFeedByIdContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(getFeedByIdSchema)
  .output(feedWithTranslationsSchema);

export const createFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(createFeedSchema);

export const updateFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(updateFeedSchema);

export const upsertFeedTranslationContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(upsertFeedTranslationSchema);

export const upsertContentContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(upsertContentSchema);

export const deleteFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(deleteFeedSchema);
