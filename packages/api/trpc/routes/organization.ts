import { TRPCError } from "@trpc/server";
import GithubSlugger from "github-slugger";
import { z } from "zod/v4";

import { auth } from "@chia/auth";
import { APIError } from "@chia/auth/types";
import {
  createProject,
  getInfiniteProjectsByOrganizationId,
  getProjectById,
  getProjectBySlug,
} from "@chia/db/repos/organization";
import { insertProjectSchema } from "@chia/db/validator/organization";
import { baseInfiniteSchema } from "@chia/db/validator/organization";
import { tryCatch } from "@chia/utils/try-catch";

import {
  adminProcedureWithACL,
  createTRPCRouter,
  onlyRootAdminProcedure,
} from "../trpc";

const slugger = new GithubSlugger();

export const organizationRouter = createTRPCRouter({
  getOrganization: onlyRootAdminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async (opts) => {
      const { data, error } = await tryCatch(
        auth.api.getFullOrganization({
          query: {
            organizationSlug: opts.input.slug,
          },
          headers: opts.ctx.headers,
        })
      );

      if (error) {
        if (error instanceof APIError) {
          switch (error.statusCode) {
            case 401:
              throw new TRPCError({ code: "UNAUTHORIZED" });
            case 403:
              throw new TRPCError({ code: "FORBIDDEN" });
            case 409:
              throw new TRPCError({ code: "CONFLICT" });
          }

          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return data;
    }),

  createOrganization: onlyRootAdminProcedure
    .input(
      z.object({
        name: z.string(),
        slug: z.string(),
        logo: z.string().optional(),
      })
    )
    .mutation(async (opts) => {
      const { data: slug, error: slugError } = await tryCatch(
        auth.api.checkOrganizationSlug({
          body: {
            slug: opts.input.slug,
          },
        })
      );

      if (slugError) {
        throw new TRPCError({ code: "CONFLICT" });
      } else if (!slug.status) {
        throw new TRPCError({ code: "CONFLICT" });
      }

      const { data: org, error } = await tryCatch(
        auth.api.createOrganization({
          body: {
            ...opts.input,
            userId: opts.ctx.session?.session.userId,
          },
        })
      );

      if (error) {
        if (error instanceof APIError) {
          switch (error.statusCode) {
            case 401:
              throw new TRPCError({ code: "UNAUTHORIZED" });
            case 403:
              throw new TRPCError({ code: "FORBIDDEN" });
            case 409:
              throw new TRPCError({ code: "CONFLICT" });
          }

          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return org;
    }),

  deleteOrganization: onlyRootAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async (opts) => {
      const { data, error } = await tryCatch(
        auth.api.deleteOrganization({
          body: {
            organizationId: opts.input.id,
          },
          headers: opts.ctx.headers,
        })
      );

      if (error) {
        if (error instanceof APIError) {
          switch (error.statusCode) {
            case 401:
              throw new TRPCError({ code: "UNAUTHORIZED" });
            case 403:
              throw new TRPCError({ code: "FORBIDDEN" });
            case 404:
              throw new TRPCError({ code: "NOT_FOUND" });
          }

          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return data;
    }),

  createProject: adminProcedureWithACL({
    project: ["create"],
  })
    .input(insertProjectSchema)
    .mutation(async (opts) => {
      return await createProject(opts.ctx.db, {
        ...opts.input,
        slug: opts.input.slug
          ? slugger.slug(opts.input.slug)
          : slugger.slug(
              `${opts.input.name}-${crypto
                .getRandomValues(new Uint32Array(1))[0]
                .toString(16)}`
            ),
      });
    }),

  getProjectById: adminProcedureWithACL({
    project: ["read"],
  })
    .input(z.object({ id: z.number() }))
    .query((opts) => {
      return getProjectById(opts.ctx.db, opts.input.id);
    }),

  getProjectBySlug: adminProcedureWithACL({
    project: ["read"],
  })
    .input(z.object({ slug: z.string() }))
    .query((opts) => {
      return getProjectBySlug(opts.ctx.db, opts.input.slug);
    }),

  getProjectsWithMeta: adminProcedureWithACL({
    project: ["read"],
  })
    .input(
      z.object({
        ...baseInfiniteSchema.shape,
        organizationId: z.string(),
      })
    )
    .query((opts) => {
      return getInfiniteProjectsByOrganizationId(opts.ctx.db, {
        ...opts.input,
        organizationId: opts.input.organizationId,
      });
    }),
});
