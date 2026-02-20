import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { all } from "better-all";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import once from "lodash/once.js";
import { start } from "workflow/api";

import { router } from "@chia/api/orpc/router";

import { env } from "../env";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import { estimateReadingTimeWorkflow } from "../workflows/estimate-reading-time.workflow.js";
import { feedEmbeddingsWorkflow } from "../workflows/feed-embeddings.workflow.js";
import {
  insertOramaDatasourceWorkflow,
  updateOramaDatasourceWorkflow,
} from "../workflows/sync-orama-datasource.workflow.js";

const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:rpc",
    })
  )
  .use("/*", async (c, next) => {
    const handler = once(
      () =>
        new RPCHandler(router, {
          interceptors: [
            onError((error) => {
              console.error(error);
              c.get("sentry").captureException(error);
            }),
          ],
        })
    );
    const { matched, response } = await handler().handle(c.req.raw, {
      prefix: "/api/v1/rpc",
      context: {
        headers: c.req.raw.headers,
        db: c.var.db,
        kv: c.var.kv,
        auth: c.var.auth,
        hooks: {
          async onFeedCreated(feed) {
            const workflows = feed.translations.map((translation) => {
              const content = feed.contents.find(
                (c) => c.feedTranslationId === translation.id
              );
              return all({
                async feedEmbeddings() {
                  return await start(feedEmbeddingsWorkflow, [
                    {
                      feedID: feed.id,
                      locale: translation.locale,
                      content:
                        content?.content ?? translation.description ?? "",
                      enabled: feed.published,
                    },
                  ]);
                },
                async estimateReadingTime() {
                  return await start(estimateReadingTimeWorkflow, [
                    {
                      feedID: feed.id,
                      locale: translation.locale,
                      content:
                        content?.content ?? translation.description ?? "",
                    },
                  ]);
                },
                async syncOramaDatasource() {
                  return await start(insertOramaDatasourceWorkflow, [
                    {
                      feedID: translation.id,
                      title: translation.title,
                      content:
                        content?.content ?? translation.description ?? "",
                      locale: translation.locale,
                      published: feed.published,
                      enabled: true,
                    },
                  ]);
                },
              });
            });

            await Promise.all(workflows);
          },
          async onFeedUpdated(feed) {
            const workflows = feed.translations.map((translation) => {
              const content = feed.contents.find(
                (c) => c.feedTranslationId === translation.id
              );
              return all({
                async feedEmbeddings() {
                  return await start(feedEmbeddingsWorkflow, [
                    {
                      feedID: feed.id,
                      locale: translation.locale,
                      content:
                        content?.content ?? translation.description ?? "",
                      enabled: feed.published,
                    },
                  ]);
                },
                async estimateReadingTime() {
                  return await start(estimateReadingTimeWorkflow, [
                    {
                      feedID: feed.id,
                      locale: translation.locale,
                      content:
                        content?.content ?? translation.description ?? "",
                    },
                  ]);
                },
                async syncOramaDatasource() {
                  return await start(updateOramaDatasourceWorkflow, [
                    {
                      feedID: translation.id,
                      title: translation.title,
                      content:
                        content?.content ?? translation.description ?? "",
                      locale: translation.locale,
                      published: feed.published,
                      enabled: true,
                    },
                  ]);
                },
              });
            });

            await Promise.all(workflows);
          },
        },
      },
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });

export default api;
