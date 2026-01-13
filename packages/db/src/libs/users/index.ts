import { eq } from "drizzle-orm";

import { withDTO } from "../";
import { schema } from "../..";
import type { InsertUserDTO } from "../validator/users";

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
