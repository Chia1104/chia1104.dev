import { OramaCloud } from "@orama/core";

import { env } from "../../env";

export const orama = new OramaCloud({
  projectId: env.ORAMA_PROJECT_ID ?? "",
  apiKey: env.ORAMA_API_KEY ?? "",
});
