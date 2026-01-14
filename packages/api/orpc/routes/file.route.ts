import GitHubSlugger from "github-slugger";

import { s3Service } from "../../s3/s3.service";
import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

const slugger = new GitHubSlugger();

export const createSignedUrlForUploadRoute = contractOS.file[
  "signed-url:create"
]
  .use(adminGuard())
  .handler(async (opts) => {
    try {
      const name = `${opts.input.area}/${slugger.slug(opts.input.key)}-${crypto.randomUUID()}`;
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
