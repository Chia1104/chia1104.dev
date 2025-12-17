import { oc } from "@orpc/contract";
import * as z from "zod";

import {
  organizationTransformSchema,
  memberTransformSchema,
  invitationTransformSchema,
  insertProjectSchema,
  projectSchema,
  baseInfiniteSchema,
} from "@chia/db/validator/organization";

export const getOrganizationContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    CONFLICT: {},
    NOT_FOUND: {},
  })
  .input(z.object({ slug: z.string() }))
  .output(
    z.object({
      ...organizationTransformSchema.shape,
      members: z.array(memberTransformSchema),
      invitations: z.array(invitationTransformSchema),
    })
  );

export const createOrganizationContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    CONFLICT: {},
    NOT_FOUND: {},
  })
  .input(
    z.object({
      name: z.string(),
      slug: z.string(),
      logo: z.string().optional(),
    })
  )
  .output(
    z.object({
      ...organizationTransformSchema.shape,
      members: z.array(memberTransformSchema.optional()),
    })
  );

export const deleteOrganizationContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    CONFLICT: {},
    NOT_FOUND: {},
  })
  .input(z.object({ id: z.string() }))
  .output(organizationTransformSchema);

export const createProjectContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    CONFLICT: {},
    NOT_FOUND: {},
  })
  .input(insertProjectSchema)
  .output(z.array(projectSchema));

export const getProjectByIdContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    NOT_FOUND: {},
  })
  .input(z.object({ id: z.number() }))
  .output(projectSchema);

export const getProjectBySlugContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    NOT_FOUND: {},
  })
  .input(z.object({ slug: z.string() }))
  .output(projectSchema);

export const getInfiniteProjectsContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    CONFLICT: {},
    NOT_FOUND: {},
  })
  .input(
    z.object({
      ...baseInfiniteSchema.shape,
      organizationId: z.string(),
    })
  )
  .output(
    z.object({
      items: z.array(projectSchema),
      nextCursor: z.union([z.string(), z.number()]).nullable(),
    })
  );
