import { eq } from "drizzle-orm";

import { withDTO } from "../";
import { schema } from "../..";
import type { InsertUserDTO } from "../validator/users";

export const updateUserProfile = withDTO(
  async (db, { name, image, id }: InsertUserDTO) => {
    return (
      await db
        .update(schema.users)
        .set({
          name,
          image,
        })
        .where(eq(schema.users.id, id))
        .returning({
          id: schema.users.id,
          name: schema.users.name,
          image: schema.users.image,
        })
    )[0];
  }
);
