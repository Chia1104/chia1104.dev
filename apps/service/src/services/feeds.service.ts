import { numericStringSchema } from "@chia/utils";

export const cursorTransform = (cursor: string) => {
  const parsed = numericStringSchema.safeParse(cursor);
  if (parsed.success) {
    return parsed.data;
  }
  return cursor;
};
