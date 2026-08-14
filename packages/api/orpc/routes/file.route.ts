import { adminGuard } from "../guards/admin.guard";
import { contractOS, slugger } from "../utils";

/**
 * Loaded on demand rather than imported statically: the router imports every route
 * module at boot, so a static import would put the whole AWS SDK in the eager module
 * graph of processes that never touch a file route.
 */
const getS3Service = async () =>
  (await import("../../s3/s3.service")).s3Service;

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

      const { url } = await (
        await getS3Service()
      ).createSignedUrlForUpload(name, {
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
    const objects = await (await getS3Service()).listObjects();
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

export const deleteObjectRoute = contractOS.file.delete
  .use(adminGuard())
  .handler(async (opts) => {
    try {
      await (await getS3Service()).deleteFile(opts.input.key);
      return { success: true };
    } catch {
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }
  });
