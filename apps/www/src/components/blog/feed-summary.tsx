"use client";

import { Accordion } from "@heroui/react";

/** The workflow-written abstract, folded above the body so a reader chooses whether to skim first. */
export const FeedSummary = ({
  label,
  summary,
}: {
  label: string;
  summary: string;
}) => (
  <Accordion
    variant="surface"
    defaultExpandedKeys={["summary"]}
    hideSeparator
    className="not-prose mb-8 w-full">
    <Accordion.Item id="summary">
      <Accordion.Heading>
        <Accordion.Trigger className="text-muted text-xs font-medium tracking-wide uppercase">
          {label}
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="text-foreground text-xs leading-relaxed">
          {summary}
        </Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion>
);
