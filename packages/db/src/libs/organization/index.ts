import type { SQLWrapper } from "drizzle-orm";

import dayjs from "@chia/utils/day";

import {
  buildCursorWhere,
  parseCursorForOrder,
  sliceNextCursor,
  withDTO,
} from "../";
import { schema } from "../..";
import { FeedOrderBy } from "../../types";
import type { InsertProjectDTO, InfiniteDTO } from "../validator/organization";

const ORGANIZATION_DATE_ORDER_BY = new Set([FeedOrderBy.CreatedAt]);

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
  return project.map((item) => ({
    ...item,
    createdAt: dayjs(item.createdAt).toISOString(),
    deletedAt: item.deletedAt ? dayjs(item.deletedAt).toISOString() : null,
  }));
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
      whereAnd?: SQLWrapper[];
    }
  ) => {
    const parsedCursor = parseCursorForOrder(
      cursor ?? null,
      orderBy,
      ORGANIZATION_DATE_ORDER_BY
    );
    const cursorFilter = buildCursorWhere(orderBy, parsedCursor, sortOrder);
    const rawFilters = whereAnd.filter(Boolean).map((condition) => ({
      RAW: condition,
    }));

    const rawItems = await db.query.project.findMany({
      orderBy: (project, { asc, desc }) => [
        sortOrder === "asc" ? asc(project[orderBy]) : desc(project[orderBy]),
      ],
      limit: limit + 1,
      where: {
        organizationId,
        ...(cursorFilter ? { AND: [cursorFilter, ...rawFilters] } : {}),
        ...(!cursorFilter && rawFilters.length ? { AND: rawFilters } : {}),
      },
    });

    const { items, nextCursor } = sliceNextCursor(
      rawItems,
      limit,
      orderBy,
      ORGANIZATION_DATE_ORDER_BY
    );

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
    where: {
      slug,
    },
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
    where: {
      id,
    },
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
