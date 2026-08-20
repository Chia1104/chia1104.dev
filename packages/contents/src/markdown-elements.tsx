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
    <div className="table-root table-root--primary my-6">
      <ScrollShadow orientation="horizontal">
        <table
          className={cn("not-prose table__content min-w-[600px]", className)}
          {...props}
        />
      </ScrollShadow>
    </div>
  </ErrorBoundary>
);

const thead: Element<"thead"> = ({ className, node: _node, ...props }) => (
  <thead className={cn("table__header", className)} {...props} />
);

const tbody: Element<"tbody"> = ({ className, node: _node, ...props }) => (
  <tbody className={cn("table__body", className)} {...props} />
);

const tr: Element<"tr"> = ({ node: _node, ...props }) => <tr {...props} />;

const th: Element<"th"> = ({ className, node: _node, ...props }) => (
  <th className={cn("table__column min-w-40", className)} {...props} />
);

const td: Element<"td"> = ({ className, node: _node, ...props }) => (
  <td className={cn("table__cell", className)} {...props} />
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
