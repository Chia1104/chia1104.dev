import crypto from "node:crypto";

import { APIError } from "@chia/auth/types";
import {
  createProject,
  getInfiniteProjectsByOrganizationId,
  getProjectById,
  getProjectBySlug,
} from "@chia/db/repos/organization";
import { tryCatch } from "@chia/utils/error-helper";

import { adminGuard } from "../guards/admin.guard";
import { contractOS, slugger } from "../utils";

export const getOrganizationRoute = contractOS.organization.details
  .use(adminGuard())
  .handler(async (opts) => {
    const { data, error } = await tryCatch(
      opts.context.auth.api.getFullOrganization({
        query: {
          organizationSlug: opts.input.slug,
        },
        headers: opts.context.headers,
      })
    );

    if (error) {
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw opts.errors.UNAUTHORIZED();
          case 403:
            throw opts.errors.FORBIDDEN();
          case 409:
            throw opts.errors.CONFLICT();
        }

        throw opts.errors.INTERNAL_SERVER_ERROR();
      }

      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    if (!data) {
      throw opts.errors.NOT_FOUND();
    }

    return data;
  });

export const createOrganizationRoute = contractOS.organization.create
  .use(adminGuard())
  .handler(async (opts) => {
    const { data: slug, error: slugError } = await tryCatch(
      opts.context.auth.api.checkOrganizationSlug({
        body: {
          slug: opts.input.slug,
        },
      })
    );

    if (slugError) {
      throw opts.errors.CONFLICT();
    } else if (!slug.status) {
      throw opts.errors.CONFLICT();
    }

    const { data: org, error } = await tryCatch(
      opts.context.auth.api.createOrganization({
        body: {
          ...opts.input,
          userId: opts.context.session?.user.id,
        },
      })
    );

    if (error) {
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw opts.errors.UNAUTHORIZED();
          case 403:
            throw opts.errors.FORBIDDEN();
          case 409:
            throw opts.errors.CONFLICT();
        }

        throw opts.errors.INTERNAL_SERVER_ERROR();
      }

      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    if (!org) {
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    return org;
  });

export const deleteOrganizationRoute = contractOS.organization.delete
  .use(adminGuard())
  .handler(async (opts) => {
    const { data, error } = await tryCatch(
      opts.context.auth.api.deleteOrganization({
        body: {
          organizationId: opts.input.id,
        },
        headers: opts.context.headers,
      })
    );

    if (error) {
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw opts.errors.UNAUTHORIZED();
          case 403:
            throw opts.errors.FORBIDDEN();
          case 404:
            throw opts.errors.NOT_FOUND();
        }

        throw opts.errors.INTERNAL_SERVER_ERROR();
      }

      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    if (!data) {
      throw opts.errors.NOT_FOUND();
    }

    return data;
  });

export const createProjectRoute = contractOS.organization.projects.create
  .use(adminGuard())
  .handler(async (opts) => {
    return await createProject(opts.context.db, {
      ...opts.input,
      slug: opts.input.slug
        ? slugger.slug(opts.input.slug)
        : slugger.slug(
            `${opts.input.name}-${crypto
              .getRandomValues(new Uint32Array(1))[0]
              ?.toString(16)}`
          ),
    });
  });

export const getProjectByIdRoute = contractOS.organization.projects[
  "details-by-id"
]
  .use(adminGuard())
  .handler(async (opts) => {
    const project = await getProjectById(opts.context.db, opts.input.id);
    if (!project) {
      throw opts.errors.NOT_FOUND();
    }
    return project;
  });

export const getProjectBySlugRoute = contractOS.organization.projects[
  "details-by-slug"
]
  .use(adminGuard())
  .handler(async (opts) => {
    const project = await getProjectBySlug(opts.context.db, opts.input.slug);
    if (!project) {
      throw opts.errors.NOT_FOUND();
    }
    return project;
  });

export const getInfiniteProjectsRoute = contractOS.organization.projects.list
  .use(adminGuard())
  .handler(async (opts) => {
    return await getInfiniteProjectsByOrganizationId(
      opts.context.db,
      opts.input
    );
  });
