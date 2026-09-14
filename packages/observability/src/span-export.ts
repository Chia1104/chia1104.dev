import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import * as z from "zod";

/** Exception event keys that carry free text; `exception.type` stays. */
const EXCEPTION_TEXT = ["exception.message", "exception.stacktrace"];

/** URL attributes that may hold a query string; the path and host stay. */
const URLS = ["url.full", "http.url", "http.target"];

const withoutQuery = (url: string) => url.split(/[?#]/, 1)[0] ?? url;

const stripContent = (span: ReadableSpan) => {
  const { attributes } = span;
  delete attributes["url.query"];
  for (const key of URLS) {
    const url = z.string().safeParse(attributes[key]);
    if (url.success) attributes[key] = withoutQuery(url.data);
  }
  for (const event of span.events) {
    if (event.name !== "exception" || !event.attributes) continue;
    for (const key of EXCEPTION_TEXT) delete event.attributes[key];
  }
};

/**
 * Removes exception messages, stack traces and URL query strings from every span before
 * `exporter` sends it. An instrumentation records whatever an error or a request carried,
 * which can be operator content, OAuth codes or keys; the log keeps the error detail.
 */
export const contentFreeExporter = (exporter: SpanExporter): SpanExporter => ({
  export: (spans, resultCallback) => {
    for (const span of spans) stripContent(span);
    exporter.export(spans, resultCallback);
  },
  shutdown: () => exporter.shutdown(),
  forceFlush: () => exporter.forceFlush?.() ?? Promise.resolve(),
});
