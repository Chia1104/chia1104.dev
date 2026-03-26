import { eq } from "drizzle-orm";

import dayjs from "@chia/utils/day";

import { schema } from "../..";
import { FeedOrderBy } from "../../types";
import { parseCursorForOrder, sliceNextCursor, withDTO } from "../index";
import type { InsertUserDTO, InfiniteDTO } from "../validator/users";

const USER_DATE_ORDER_BY = new Set([
  FeedOrderBy.UpdatedAt,
  FeedOrderBy.CreatedAt,
]);

export const updateUserProfile = withDTO(
  async (db, { name, image, id }: InsertUserDTO) => {
    return (
      await db
        .update(schema.user)
        .set({
          name,
          image,
        })
        .where(eq(schema.user.id, id))
        .returning({
          id: schema.user.id,
          name: schema.user.name,
          image: schema.user.image,
        })
    )[0];
  }
);

export const getInfiniteUsers = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.CreatedAt,
      sortOrder = "desc",
    }: InfiniteDTO
  ) => {
    const parsedCursor = parseCursorForOrder(
      cursor ?? null,
      orderBy,
      USER_DATE_ORDER_BY
    );

    const rawItems = await db.query.user.findMany({
      orderBy: (user, { asc, desc }) => [
        sortOrder === "asc" ? asc(user[orderBy]) : desc(user[orderBy]),
      ],
      limit: limit + 1,
      where: parsedCursor
        ? {
            [orderBy]: {
              [sortOrder === "asc" ? "gte" : "lte"]: parsedCursor,
            },
          }
        : undefined,
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        banned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const { items, nextCursor } = sliceNextCursor(
      rawItems,
      limit,
      orderBy,
      USER_DATE_ORDER_BY
    );

    const serializedItems = items.map((item) => ({
      ...item,
      createdAt: dayjs(item.createdAt).toISOString(),
      updatedAt: dayjs(item.updatedAt).toISOString(),
    }));

    return {
      items: serializedItems,
      nextCursor,
    };
  }
);
