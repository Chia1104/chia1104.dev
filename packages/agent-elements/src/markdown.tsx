"use client";

import { AlertDialog, Button, Alert } from "@heroui/react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { ExternalLink } from "lucide-react";
import { Streamdown } from "streamdown";
import type { Components, LinkSafetyModalProps } from "streamdown";

import { markdownElements } from "@chia/contents/markdown-elements";
import { CopyButton } from "@chia/ui/copy-button";
import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./provider.tsx";

/**
 * Streamdown's defaults are styled with shadcn tokens (`bg-muted`, `text-muted-foreground`…).
 * HeroUI defines `muted` as a text colour, so those defaults come out as mid-grey slabs in both
 * schemes. Tables and emphasis come from the blog's shared elements so assistant prose reads like
 * an article; the rest restates the affected elements in HeroUI tokens. Everything not listed
 * (headings, lists, code blocks) keeps Streamdown's rendering. A host can layer its own on top
 * through `components`.
 */
export const markdownComponents: Components = {
  ...markdownElements,
  inlineCode: ({ className, node: _node, ...props }) => (
    <code
      className={cn(
        "bg-surface-secondary text-foreground rounded-md px-1.5 py-0.5 font-mono text-[0.875em]",
        className
      )}
      {...props}
    />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <Alert className="bg-surface-secondary gap-2 px-2.5 py-2">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{props.children}</Alert.Description>
      </Alert.Content>
    </Alert>
  ),
  hr: ({ className, node: _node, ...props }) => (
    <hr className={cn("border-border my-6", className)} {...props} />
  ),
};

/**
 * The confirmation Streamdown shows before following a link the model wrote. Its own modal is
 * English and shadcn-styled; this one reads the catalog and HeroUI.
 */
const LinkSafetyDialog = ({
  isOpen,
  onClose,
  onConfirm,
  url,
}: LinkSafetyModalProps) => {
  const labels = useAgentLabels();
  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="accent">
                <ExternalLink className="size-5" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>
                {labels.linkSafetyTitle}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="gap-3">
              <p className="text-muted text-sm">
                {labels.linkSafetyDescription}
              </p>
              <div className="bg-surface-secondary flex items-center gap-2 rounded-lg px-3 py-2">
                <span className="text-foreground min-w-0 flex-1 truncate font-mono text-xs">
                  {url}
                </span>
                <CopyButton
                  aria-label={labels.copy}
                  className="size-7 min-w-7"
                  content={url}
                  translations={{ copy: labels.copy, copied: labels.copied }}
                  variant="ghost"
                />
              </div>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button onPress={onClose} variant="tertiary">
                {labels.cancel}
              </Button>
              <Button
                onPress={() => {
                  onConfirm();
                  onClose();
                }}>
                <ExternalLink className="size-4" />
                {labels.openLink}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
};

const renderLinkSafety = (props: LinkSafetyModalProps) => (
  <LinkSafetyDialog {...props} />
);

export interface MarkdownProps {
  text: string;
  /** Still arriving: incomplete blocks are repaired and a caret follows the text. */
  streaming?: boolean;
  /** Element overrides layered over {@link markdownComponents}. */
  components?: Components;
  className?: string;
}

/**
 * Assistant text as markdown, tolerant of the half-finished syntax a stream produces. The CJK
 * plugin keeps emphasis and strikethrough working across Chinese punctuation. Links the model
 * wrote are confirmed before opening.
 */
export const Markdown = ({
  className,
  components,
  streaming = false,
  text,
}: MarkdownProps) => (
  <Streamdown
    className={cn("text-foreground text-[15px] leading-7", className)}
    components={
      components ? { ...markdownComponents, ...components } : markdownComponents
    }
    controls={{
      code: { copy: true, download: false },
      table: false,
      mermaid: false,
    }}
    isAnimating={streaming}
    linkSafety={{ enabled: true, renderModal: renderLinkSafety }}
    mode={streaming ? "streaming" : "static"}
    plugins={{ cjk, code }}
    shikiTheme={["github-light", "github-dark"]}>
    {text}
  </Streamdown>
);
