/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import Image from "next/image";

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
    <div className="my-10 max-w-full overflow-x-auto">
      <table className="not-prose bg-content1 h-auto w-full min-w-full table-auto overflow-hidden rounded-lg">
        {props.children}
      </table>
    </div>
  ),
  thead: (props: any) => (
    <thead className="[&>tr]:first:rounded-lg">{props.children}</thead>
  ),
  tr: (props: any) => (
    <tr className="group data-[focus-visible=true]:outline-focus outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-offset-2">
      {props.children}
    </tr>
  ),
  th: (props: any) => (
    <th className="group bg-default-100 text-foreground-500 text-tiny data-[hover=true]:text-foreground-400 data-[focus-visible=true]:outline-focus h-10 px-3 text-start align-middle font-semibold whitespace-nowrap outline-none first:rounded-l-lg last:rounded-r-lg data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-offset-2 data-[sortable=true]:cursor-pointer rtl:first:rounded-l-[unset] rtl:first:rounded-r-lg rtl:last:rounded-l-lg rtl:last:rounded-r-[unset]">
      {props.children}
    </th>
  ),
  td: (props: any) => (
    <td className="text-small data-[focus-visible=true]:outline-focus group-data-[disabled=true]:text-foreground-300 before:bg-default/60 data-[selected=true]:text-default-foreground relative px-3 py-2 text-start align-middle font-normal whitespace-normal outline-none group-data-[disabled=true]:cursor-not-allowed before:absolute before:inset-0 before:z-0 before:opacity-0 before:content-[''] first:before:rounded-l-lg last:before:rounded-r-lg data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-offset-2 data-[selected=true]:before:opacity-100 rtl:first:before:rounded-l-[unset] rtl:first:before:rounded-r-lg rtl:last:before:rounded-l-lg rtl:last:before:rounded-r-[unset] [&>*]:relative [&>*]:z-1">
      {props.children}
    </td>
  ),
  strong: (props: any) => (
    <strong className="dark:c-text-bg-purple-half c-text-bg-pink-half">
      {props.children}
    </strong>
  ),
  Mermaid,
};
