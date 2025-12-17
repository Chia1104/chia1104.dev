import type { SQLWrapper } from "drizzle-orm";

import dayjs from "@chia/utils/day";

import { cursorTransform, dateToTimestamp, withDTO } from "../";
import { schema } from "../..";
import { FeedOrderBy } from "../../types";
import type { InsertProjectDTO, InfiniteDTO } from "../validator/organization";

export const createProject = withDTO(async (db, dto: InsertProjectDTO) => {
  const project = await db
    .insert(schema.project)
    .values({
      organizationId: dto.organizationId,
      name: dto.name,
      slug: dto.slug,
      createdAt: dto.createdAt ? dayjs(dto.createdAt).toDate() : undefined,
    })
    .returning();
  return project;
});

export const getInfiniteProjectsByOrganizationId = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.CreatedAt,
      sortOrder = "desc",
      whereAnd = [],
      organizationId,
    }: InfiniteDTO & {
      organizationId: string;
      whereAnd?: (SQLWrapper | undefined)[];
    }
  ) => {
    const parsedCursor = cursor
      ? cursorTransform(
          cursor,
          orderBy === FeedOrderBy.CreatedAt ? "timestamp" : "default"
        )
      : null;
    const items = await db.query.project.findMany({
      orderBy: (project, { asc, desc }) => [
        sortOrder === "asc" ? asc(project[orderBy]) : desc(project[orderBy]),
      ],
      limit: limit + 1,
      where: parsedCursor
        ? (project, { gte, lte, eq, and }) =>
            and(
              sortOrder === "asc"
                ? gte(project[orderBy], parsedCursor)
                : lte(project[orderBy], parsedCursor),
              eq(project.organizationId, organizationId),
              ...whereAnd
            )
        : (project, { eq, and }) =>
            and(eq(project.organizationId, organizationId), ...whereAnd),
    });
    let nextCursor: ReturnType<typeof cursorTransform> | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor =
        orderBy === FeedOrderBy.CreatedAt
          ? dateToTimestamp(nextItem?.[orderBy] as dayjs.ConfigType)
          : nextItem?.[orderBy];
    }
    const serializedItems = items.map((item) => ({
      ...item,
      createdAt: dayjs(item.createdAt).toISOString(),
      deletedAt: item.deletedAt ? dayjs(item.deletedAt).toISOString() : null,
    }));
    return {
      items: serializedItems,
      nextCursor,
    };
  }
);

export const getProjectBySlug = withDTO(async (db, slug: string) => {
  const project = await db.query.project.findFirst({
    where: (project, { eq }) => eq(project.slug, slug),
  });
  if (!project) {
    return null;
  }
  return {
    ...project,
    createdAt: dayjs(project.createdAt).toISOString(),
    deletedAt: project.deletedAt
      ? dayjs(project.deletedAt).toISOString()
      : null,
  };
});

export const getProjectById = withDTO(async (db, id: number) => {
  const project = await db.query.project.findFirst({
    where: (project, { eq }) => eq(project.id, id),
  });
  if (!project) {
    return null;
  }
  return {
    ...project,
    createdAt: dayjs(project.createdAt).toISOString(),
    deletedAt: project.deletedAt
      ? dayjs(project.deletedAt).toISOString()
      : null,
  };
});
