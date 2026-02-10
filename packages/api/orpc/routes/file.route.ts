import { s3Service } from "../../s3/s3.service";
import { adminGuard } from "../guards/admin.guard";
import { contractOS, slugger } from "../utils";

export const createSignedUrlForUploadRoute = contractOS.file[
  "signed-url:create"
]
  .use(adminGuard())
  .handler(async (opts) => {
    try {
      const lastDotIndex = opts.input.key.lastIndexOf(".");
      const hasExtension =
        lastDotIndex > 0 && lastDotIndex < opts.input.key.length - 1;

      const filename = hasExtension
        ? opts.input.key.slice(0, lastDotIndex)
        : opts.input.key;
      const extension = hasExtension ? opts.input.key.slice(lastDotIndex) : "";

      const sluggedFilename = slugger.slug(filename);
      const uuid = crypto.randomUUID();
      const name = `${opts.input.area}/${sluggedFilename}-${uuid}${extension}`;

      const { url } = await s3Service.createSignedUrlForUpload(name, {
        sha256Checksum: opts.input.sha256Checksum,
        type: opts.input.type,
        size: opts.input.size,
      });
      return { url };
    } catch {
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }
  });

export const listObjectsRoute = contractOS.file.list
  .use(adminGuard())
  .handler(async (opts) => {
    const objects = await s3Service.listObjects();
    if (!objects) {
      throw opts.errors.BAD_REQUEST();
    }
    return (
      objects.Contents?.map((object) => ({
        key: object.Key ?? "",
        size: object.Size ?? 0,
      })) ?? []
    );
  });
