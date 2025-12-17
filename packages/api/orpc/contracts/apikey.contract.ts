import { oc } from "@orpc/contract";
import * as z from "zod";

import { baseInfiniteSchema } from "@chia/db/validator/apikey";

import {
  originalApiKeySchema,
  apiKeySchema,
  createAPIKeySchema,
} from "../validators";

export const createAPIKeyContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      projectId: z.number().optional(),
      ...createAPIKeySchema.shape,
    })
  )
  .output(originalApiKeySchema);

export const getAllApiKeysWithMetaContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z
      .object({
        ...baseInfiniteSchema.shape,
        withProject: z.boolean().optional(),
      })
      .optional()
  )
  .output(
    z.object({
      items: z.array(apiKeySchema),
      nextCursor: z.union([z.string(), z.number()]).nullable(),
    })
  );

export const revokeApiKeyContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.string());

export const deleteApiKeyContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.string());

export const updateApiKeyContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      name: z.string(),
      keyId: z.string(),
    })
  );
