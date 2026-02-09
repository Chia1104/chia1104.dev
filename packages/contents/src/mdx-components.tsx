/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import Image from "next/image";

import { ScrollShadow } from "@heroui/react";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Banner } from "fumadocs-ui/components/banner";
import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { File, Folder, Files } from "fumadocs-ui/components/files";
import { Heading } from "fumadocs-ui/components/heading";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import { cn } from "@chia/ui/utils/cn.util";

import { Mermaid } from "./components/mermaid";

export const FumadocsComponents = {
  ...defaultComponents,
  Tabs,
  Tab,
  Callout,
  TypeTable,
  Accordion,
  Accordions,
  Banner,
  File,
  Folder,
  Files,
  pre: ({ ref: _ref, ...props }: any) => (
    <CodeBlock {...props}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  ),
  blockquote: (props: any) => <Callout>{props.children}</Callout>,
  Image: (props: any) => (
    <Image
      {...props}
      fill
      className="h-auto w-full rounded-lg object-cover"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
    />
  ),
  img: (props: any) => (
    <ImageZoom
      {...props}
      width={700}
      height={400}
      className="h-auto w-full rounded-lg object-cover"
    />
  ),
  h1: (props: any) => (
    <Heading as="h1" {...props} className="prose-a:no-underline" />
  ),
  h2: (props: any) => (
    <Heading as="h2" {...props} className="prose-a:no-underline" />
  ),
  h3: (props: any) => (
    <Heading as="h3" {...props} className="prose-a:no-underline" />
  ),
  h4: (props: any) => (
    <Heading as="h4" {...props} className="prose-a:no-underline" />
  ),
  h5: (props: any) => (
    <Heading as="h5" {...props} className="prose-a:no-underline" />
  ),
  h6: (props: any) => (
    <Heading as="h6" {...props} className="prose-a:no-underline" />
  ),
} as MDXComponents;

/**
 * V1 MDX Components
 */
export const V1MDXComponents: MDXComponents = {
  ImageWrapper: (props: any) => (
    <div className="relative w-full overflow-hidden rounded-lg">
      {props.children}
    </div>
  ),
  ImageWrapperWithMaxWidth: (props: any) => (
    <div className="relative w-full max-w-[250px] overflow-hidden rounded-lg">
      {props.children}
    </div>
  ),
  FlexCenter: (props: any) => (
    <div className="flex w-full justify-center">{props.children}</div>
  ),
  table: (props: any) => (
    <ScrollShadow orientation="vertical" hideScrollBar>
      <table
        {...props}
        className={cn(
          "prose-th:border-none prose-th:px-2 prose-td:px-2 w-full",
          props.className
        )}>
        {props.children}
      </table>
    </ScrollShadow>
  ),
  th: (props: any) => (
    <th {...props} className={cn("min-w-[160px]", props.className)}>
      {props.children}
    </th>
  ),
  strong: (props: any) => (
    <strong className="dark:c-text-bg-purple-half c-text-bg-pink-half">
      {props.children}
    </strong>
  ),
  Mermaid,
};
