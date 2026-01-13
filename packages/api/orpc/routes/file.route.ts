import { s3Service } from "../../s3/s3.service";
import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

export const createSignedUrlForUploadRoute = contractOS.file[
  "signed-url:create"
]
  .use(adminGuard())
  .handler(async (opts) => {
    try {
      const url = await s3Service.createSignedUrlForUpload(opts.input.key);
      return { url };
    } catch {
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }
  });
