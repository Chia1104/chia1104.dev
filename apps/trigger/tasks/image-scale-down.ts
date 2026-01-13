import { schemaTask } from "@trigger.dev/sdk/v3";
import sharp from "sharp";
import * as z from "zod";

import { s3Service } from "@chia/api/s3/service";

import { TaskID } from "./tasks.constant";

export const requestSchema = z.object({
  imageKey: z.string(),
});

export const imageScaleDownTask = schemaTask({
  id: TaskID.ImageScaleDown,
  schema: requestSchema,
  run: async ({ imageKey }) => {
    const imageBuffer = await s3Service.getFileByteArray(imageKey);

    const placeholderBuffer = await sharp(imageBuffer)
      .resize(8, 8, { fit: "inside" })
      .blur(2)
      .webp({ quality: 60 })
      .toBuffer();

    await s3Service.putObject(
      "processed-assets",
      `placeholder/${imageKey}`,
      placeholderBuffer
    );
  },
});
