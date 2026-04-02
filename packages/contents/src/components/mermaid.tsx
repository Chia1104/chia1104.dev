"use client";

import { use, useEffect, useId, useState } from "react";

import { Button, Card, Modal, ScrollShadow } from "@heroui/react";
import { useTheme } from "next-themes";

export function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return;
  return <MermaidContent chart={chart} />;
}

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(
  key: string,
  setPromise: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;
  const promise = setPromise();
  cache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const { default: mermaid } = use(
    cachePromise("mermaid", () => import("mermaid"))
  );
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    fontFamily: "inherit",
    themeCSS: "margin: 1.5rem auto 0;",
    theme: resolvedTheme === "dark" ? "dark" : "default",
  });
  const { svg, bindFunctions } = use(
    cachePromise(`${chart}-${resolvedTheme}`, () => {
      return mermaid.render(id, chart.replaceAll("\\n", "\n"));
    })
  );

  return (
    <Card className="relative my-4">
      <Modal>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          className="absolute top-2 right-2 z-10"
          aria-label="expand chart">
          <span className="i-mdi-arrow-expand size-4" />
        </Button>
        <Modal.Backdrop>
          <Modal.Container placement="center">
            <Modal.Dialog className="w-[90vw] max-w-5xl">
              <Modal.CloseTrigger />
              <Modal.Body className="overflow-auto p-6">
                <div
                  ref={(container) => {
                    if (container) bindFunctions?.(container);
                  }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                  className="[&_svg]:h-auto [&_svg]:w-full"
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <ScrollShadow hideScrollBar>
        <div
          ref={(container) => {
            if (container) bindFunctions?.(container);
          }}
          className="w-max min-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </ScrollShadow>
    </Card>
  );
}
