import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Banner } from "fumadocs-ui/components/banner";
import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import type { CodeBlockProps } from "fumadocs-ui/components/codeblock";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultComponents from "fumadocs-ui/mdx";
import { Popup, PopupContent, PopupTrigger } from "fumadocs-ui/twoslash/popup";
import type { MDXComponents } from "mdx/types";
import Image from "next/image";

export const fumadocsComponents = {
  ...defaultComponents,
  Popup,
  PopupContent,
  PopupTrigger,
  Tabs,
  Tab,
  Callout,
  TypeTable,
  Accordion,
  Accordions,
  Banner,
  pre: (props: CodeBlockProps) => (
    <CodeBlock {...props}>
      <Pre className="max-h-[400px] bg-content1">{props.children}</Pre>
    </CodeBlock>
  ),
  blockquote: (props: any) => <Callout>{props.children}</Callout>,
  ImageWrapper: (props: any) => (
    <div className="relative w-full overflow-hidden rounded-lg">
      {props.children}
    </div>
  ),
  Image: (props: any) => (
    <Image
      {...props}
      fill
      className="w-full object-cover h-auto rounded-lg"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
    />
  ),
  img: (props: any) => (
    <ImageZoom
      {...props}
      width={700}
      height={400}
      className="w-full object-cover h-auto rounded-lg"
    />
  ),
  table: (props: any) => (
    <table className="min-w-full h-auto table-auto w-full not-prose my-10 bg-content1 overflow-auto rounded-large shadow-small">
      {props.children}
    </table>
  ),
  thead: (props: any) => (
    <thead className="[&>tr]:first:rounded-lg">{props.children}</thead>
  ),
  tr: (props: any) => (
    <tr className="group outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2">
      {props.children}
    </tr>
  ),
  th: (props: any) => (
    <th className="group px-3 h-10 align-middle bg-default-100 whitespace-nowrap text-foreground-500 text-tiny font-semibold first:rounded-l-lg rtl:first:rounded-r-lg rtl:first:rounded-l-[unset] last:rounded-r-lg rtl:last:rounded-l-lg rtl:last:rounded-r-[unset] data-[sortable=true]:cursor-pointer data-[hover=true]:text-foreground-400 outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 text-start">
      {props.children}
    </th>
  ),
  td: (props: any) => (
    <td className="py-2 px-3 relative align-middle whitespace-normal text-small font-normal [&>*]:z-1 [&>*]:relative outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 before:content-[''] before:absolute before:z-0 before:inset-0 before:opacity-0 data-[selected=true]:before:opacity-100 group-data-[disabled=true]:text-foreground-300 group-data-[disabled=true]:cursor-not-allowed before:bg-default/60 data-[selected=true]:text-default-foreground first:before:rounded-l-lg rtl:first:before:rounded-r-lg rtl:first:before:rounded-l-[unset] last:before:rounded-r-lg rtl:last:before:rounded-l-lg rtl:last:before:rounded-r-[unset] text-start">
      {props.children}
    </td>
  ),
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...fumadocsComponents,
    ...components,
  };
}
