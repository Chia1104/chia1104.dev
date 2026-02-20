import { fetch } from "workflow";
import * as z from "zod";

import { Locale } from "@chia/db/types";

import { env } from "../env";

export const requestSchema = z.object({
  feedID: z.number(),
  title: z.string(),
  content: z.string(),
  locale: z.enum(Locale).optional().default(Locale.zhTW),
  published: z.boolean(),
  enabled: z.boolean().optional().default(true),
});

type Request = z.input<typeof requestSchema>;

export const updateOramaDatasourceWorkflow = async (request: Request) => {
  "use workflow";

  const parsedRequest = requestSchema.parse(request);

  if (
    !parsedRequest.enabled ||
    !env.ORAMA_PROJECT_ID ||
    !env.ORAMA_API_KEY ||
    !env.ORAMA_DATASOURCE_ID
  ) {
    console.log("Sync Orama datasource is disabled, skipping", {
      feedID: parsedRequest.feedID,
    });
    return {
      success: true,
    };
  }

  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

  const OramaCloud = await import("@orama/core").then((m) => m.OramaCloud);

  const orama = new OramaCloud({
    projectId: env.ORAMA_PROJECT_ID,
    apiKey: env.ORAMA_API_KEY,
  });

  const datasource = orama.dataSource(env.ORAMA_DATASOURCE_ID);

  await datasource.upsertDocuments([
    {
      id: parsedRequest.feedID,
      title: parsedRequest.title,
      content: parsedRequest.content,
      locale: parsedRequest.locale,
      published: parsedRequest.published,
    },
  ]);

  console.log("Sync Orama datasource completed", {
    feedID: parsedRequest.feedID,
  });

  return {
    success: true,
  };
};

export const insertOramaDatasourceWorkflow = async (request: Request) => {
  "use workflow";

  const parsedRequest = requestSchema.parse(request);

  if (
    !parsedRequest.enabled ||
    !env.ORAMA_PROJECT_ID ||
    !env.ORAMA_API_KEY ||
    !env.ORAMA_DATASOURCE_ID
  ) {
    console.log("Insert Orama datasource is disabled, skipping", {
      feedID: parsedRequest.feedID,
    });
    return {
      success: true,
    };
  }

  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

  const OramaCloud = await import("@orama/core").then((m) => m.OramaCloud);

  const orama = new OramaCloud({
    projectId: env.ORAMA_PROJECT_ID ?? "",
    apiKey: env.ORAMA_API_KEY ?? "",
  });

  const datasource = orama.dataSource(env.ORAMA_DATASOURCE_ID ?? "");

  await datasource.insertDocuments([
    {
      id: parsedRequest.feedID,
      title: parsedRequest.title,
      content: parsedRequest.content,
      locale: parsedRequest.locale,
      published: parsedRequest.published,
    },
  ]);

  console.log("Insert Orama datasource completed", {
    feedID: parsedRequest.feedID,
  });

  return {
    success: true,
  };
};
