import dayjs from "@chia/utils/day";

import { withDTO } from "../";
import { schema } from "../..";
import type { InsertProjectDTO } from "../validator/organization";

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
