import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";

import { contentFreeExporter } from "../src/span-export";

const exportOne = (
  record: (tracer: ReturnType<BasicTracerProvider["getTracer"]>) => void
) => {
  const exported = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(contentFreeExporter(exported))],
  });
  record(provider.getTracer("test"));
  const [span] = exported.getFinishedSpans();
  return span;
};

describe("contentFreeExporter", () => {
  it("keeps the exception type and drops its message and stack", () => {
    const span = exportOne((tracer) => {
      const active = tracer.startSpan("tool");
      active.recordException(new TypeError("draft: my private note"));
      active.end();
    });

    const [event] = span?.events ?? [];
    expect(event?.name).toBe("exception");
    expect(event?.attributes).toEqual({ "exception.type": "TypeError" });
    expect(JSON.stringify(span?.events)).not.toContain("private note");
  });

  it("strips query strings from URL attributes", () => {
    const span = exportOne((tracer) => {
      const active = tracer.startSpan("GET", {
        attributes: {
          "url.full":
            "https://service.chia1104.dev/api/v1/spotify/oauth/callback?code=secret#frag",
          "url.query": "code=secret",
          "http.target": "/callback?code=secret",
          "http.route": "/api/v1/spotify/oauth/callback",
        },
      });
      active.end();
    });

    expect(span?.attributes).toEqual({
      "url.full": "https://service.chia1104.dev/api/v1/spotify/oauth/callback",
      "http.target": "/callback",
      "http.route": "/api/v1/spotify/oauth/callback",
    });
  });
});
