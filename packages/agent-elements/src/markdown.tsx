"use client";

import {
  Children,
  isValidElement,
  useState,
  useSyncExternalStore,
} from "react";

import { Alert, AlertDialog, Button, Card } from "@heroui/react";
import { cjk } from "@streamdown/cjk";
import { ExternalLink } from "lucide-react";
import { Streamdown } from "streamdown";
import type { Components } from "streamdown";

import { markdownElements } from "@chia/contents/markdown-elements";
import { CopyButton } from "@chia/ui/copy-button";
import { cn } from "@chia/ui/utils/cn.util";

import { HighlightedCode } from "./code-block.tsx";
import { useAgentLabels } from "./labels-context.tsx";

/** Streamdown hands the fence body as a string, or as a `<code>` element wrapping one. */
const codeText = (children: React.ReactNode): string =>
  Children.toArray(children)
    .map((child) =>
      isValidElement<{ children?: React.ReactNode }>(child)
        ? child.props.children
        : child
    )
    .join("");

const CodeBlock: Components["code"] = ({ children, className }) => {
  const labels = useAgentLabels();
  const language = /language-(\S+)/.exec(className ?? "")?.[1] ?? "text";
  const code = codeText(children).replace(/\n$/, "");
  return (
    <Card className="my-4 gap-0 overflow-hidden p-0" variant="secondary">
      <div className="border-border flex h-9 items-center justify-between border-b px-3">
        <span className="text-muted font-mono text-xs lowercase">
          {language}
        </span>
        <CopyButton
          aria-label={labels.copy}
          className="size-7 min-w-7"
          content={code}
          translations={{ copy: labels.copy, copied: labels.copied }}
          variant="ghost"
        />
      </div>
      <HighlightedCode className="p-3" code={code} language={language} />
    </Card>
  );
};

const LinkSafetyDialog = ({
  isOpen,
  onClose,
  onConfirm,
  url,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  url: string;
}) => {
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

// Nothing to subscribe to: the origin never changes after the first client render.
const subscribeNever = () => () => undefined;

/** The page's own origin once it is in a browser; `null` while rendering on the server. */
const useOrigin = (): string | null =>
  useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => null
  );

/**
 * Links from the model. One that stays on this origin is an ordinary link, so a section of
 * the page the reader is on scrolls into view; anything else asks first, because the model may
 * have been handed the URL by a page it read.
 */
const MarkdownLink: Components["a"] = ({
  children,
  className,
  href,
  node: _node,
  // Streamdown marks every link for a new tab; a link into this site navigates in place.
  rel: _rel,
  target: _target,
  ...props
}) => {
  const [open, setOpen] = useState(false);
  const origin = useOrigin();
  const linkClass = cn("font-medium wrap-anywhere underline", className);
  if (!href || href === "streamdown:incomplete-link") {
    return (
      <span className={linkClass} data-incomplete="true" data-streamdown="link">
        {children}
      </span>
    );
  }
  if (origin !== null && URL.parse(href)?.origin === origin) {
    return (
      <a className={linkClass} data-streamdown="link" href={href} {...props}>
        {children}
      </a>
    );
  }
  return (
    <>
      <button
        className={cn("appearance-none text-left", linkClass)}
        data-streamdown="link"
        onClick={() => setOpen(true)}
        type="button">
        {children}
      </button>
      <LinkSafetyDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => window.open(href, "_blank", "noreferrer")}
        url={href}
      />
    </>
  );
};

/**
 * Streamdown defaults use shadcn tokens (`bg-muted`, `text-muted-foreground`); HeroUI's `muted`
 * is a text colour, so those defaults render as grey slabs. Tables and emphasis come from the
 * blog elements; the rest is restated in HeroUI tokens. Unlisted elements keep Streamdown's
 * rendering. Hosts layer overrides through `components`.
 */
export const markdownComponents: Components = {
  ...markdownElements,
  code: CodeBlock,
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
  a: MarkdownLink,
};

export interface MarkdownProps {
  text: string;
  /** Incomplete blocks are repaired and a caret follows the text. */
  streaming?: boolean;
  components?: Components;
  className?: string;
}

/**
 * CJK plugin keeps emphasis and strikethrough working across Chinese punctuation. Streamdown
 * instantiates the fenced-code element and links itself, so copy and confirmation strings come
 * from labels context. Needs no session; without a provider the `en-US` catalog applies.
 */
export const Markdown = ({
  className,
  components,
  streaming = false,
  text,
}: MarkdownProps) => (
  <Streamdown
    className={cn(
      "text-foreground text-sm leading-6",
      "[&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h4]:text-sm",
      "**:data-[streamdown=link]:text-foreground/70 **:data-[streamdown=link]:decoration-muted/70 **:data-[streamdown=link]:underline-offset-[5px]",
      "**:data-[streamdown=link]:transition-colors **:data-[streamdown=link]:duration-300 **:data-[streamdown=link]:ease-in-out",
      "**:data-[streamdown=link]:hover:decoration-foreground/70",
      className
    )}
    components={
      components ? { ...markdownComponents, ...components } : markdownComponents
    }
    controls={{ table: false, mermaid: false }}
    isAnimating={streaming}
    mode={streaming ? "streaming" : "static"}
    plugins={{ cjk }}>
    {text}
  </Streamdown>
);
