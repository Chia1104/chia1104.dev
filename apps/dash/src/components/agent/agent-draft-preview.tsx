"use client";

import { Card, Chip, ScrollShadow } from "@heroui/react";
import { FileText } from "lucide-react";

import type { RouterOutputs } from "@/libs/orpc/types";

type AgentDraft = RouterOutputs["agent"]["sessions"]["get"]["draft"];

interface AgentDraftPreviewProps {
  draft: AgentDraft;
}

const jsonOf = <TValue,>(value: TValue) => JSON.stringify(value, null, 2);

export const AgentDraftPreview = ({ draft }: AgentDraftPreviewProps) => {
  if (!draft) {
    return (
      <div className="text-muted flex min-h-72 flex-col items-center justify-center gap-3 text-center">
        <FileText className="size-8" />
        <p>This agent kind does not expose a writing draft.</p>
      </div>
    );
  }

  const translations = Object.entries(draft.translations);

  return (
    <ScrollShadow className="min-h-0 flex-1 p-4" size={56}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Card variant="secondary">
          <Card.Header className="flex-row items-center gap-2">
            <FileText className="text-muted size-4" />
            <Card.Title>Feed metadata</Card.Title>
            {draft.committedFeedId ? (
              <Chip
                className="ml-auto"
                color="success"
                size="sm"
                variant="soft">
                <Chip.Label>Feed #{draft.committedFeedId}</Chip.Label>
              </Chip>
            ) : null}
          </Card.Header>
          <Card.Content>
            <pre className="bg-surface overflow-x-auto rounded-xl p-3 text-xs whitespace-pre-wrap">
              {jsonOf(draft.feedMeta)}
            </pre>
          </Card.Content>
        </Card>

        {translations.length === 0 ? (
          <Card variant="secondary">
            <Card.Content className="text-muted text-sm">
              No locale draft has been created yet.
            </Card.Content>
          </Card>
        ) : (
          translations.map(([locale, translation]) => (
            <Card key={locale} variant="secondary">
              <Card.Header className="flex-row items-center gap-2">
                <Card.Title>{translation.title || "Untitled"}</Card.Title>
                <Chip className="ml-auto" size="sm" variant="soft">
                  <Chip.Label>{locale}</Chip.Label>
                </Chip>
              </Card.Header>
              <Card.Content className="gap-4">
                {translation.excerpt ? (
                  <p className="text-muted text-sm">{translation.excerpt}</p>
                ) : null}
                <pre className="bg-surface max-h-120 overflow-auto rounded-xl p-4 text-sm leading-6 whitespace-pre-wrap">
                  {translation.content || "No content yet."}
                </pre>
              </Card.Content>
            </Card>
          ))
        )}
      </div>
    </ScrollShadow>
  );
};
