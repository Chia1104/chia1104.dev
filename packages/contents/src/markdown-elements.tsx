"use client";

import type { ComponentType, JSX } from "react";

import { Alert, ScrollShadow } from "@heroui/react";

import { ErrorBoundary } from "@chia/ui/error-boundary";
import { cn } from "@chia/ui/utils/cn.util";

/**
 * Both MDX and Streamdown hand element overrides their HTML props; Streamdown additionally passes
 * the hast `node`, which must not reach the DOM.
 */
type ElementProps<T extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[T] & { node?: unknown };

type Element<T extends keyof JSX.IntrinsicElements> = ComponentType<
  ElementProps<T>
>;

const table: Element<"table"> = ({ className, node: _node, ...props }) => (
  <ErrorBoundary
    errorElement={
      <Alert status="danger" className="not-prose my-2">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Error loading table</Alert.Title>
          <Alert.Description>Please try again later.</Alert.Description>
        </Alert.Content>
      </Alert>
    }>
    <div className="my-6 w-full">
      <ScrollShadow orientation="horizontal">
        <table
          className={cn(
            "not-prose w-full min-w-[600px] border-collapse text-sm",
            className
          )}
          {...props}
        />
      </ScrollShadow>
    </div>
  </ErrorBoundary>
);

const thead: Element<"thead"> = ({ className, node: _node, ...props }) => (
  <thead className={cn("bg-surface-secondary", className)} {...props} />
);

const tbody: Element<"tbody"> = ({ node: _node, ...props }) => (
  <tbody {...props} />
);

const tr: Element<"tr"> = ({ className, node: _node, ...props }) => (
  <tr className={cn("border-border border-b", className)} {...props} />
);

const th: Element<"th"> = ({ className, node: _node, ...props }) => (
  <th
    className={cn(
      "text-foreground min-w-40 px-3 py-2 text-left font-semibold",
      className
    )}
    {...props}
  />
);

const td: Element<"td"> = ({ className, node: _node, ...props }) => (
  <td className={cn("px-3 py-2 align-top", className)} {...props} />
);

const strong: Element<"strong"> = ({ className, node: _node, ...props }) => (
  <strong
    className={cn("dark:c-text-bg-purple-half c-text-bg-pink-half", className)}
    {...props}
  />
);

/** Element overrides shared by blog MDX and the agent's markdown so prose reads the same in both. */
export const markdownElements = {
  table,
  thead,
  tbody,
  tr,
  th,
  td,
  strong,
};
