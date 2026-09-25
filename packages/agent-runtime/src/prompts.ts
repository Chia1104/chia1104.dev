/** Prompt text: the tags that frame a prompt's data, slash commands and skills. */

type XmlAttributes = Readonly<Record<string, string | number>>;

const openTag = (tag: string, attributes: XmlAttributes): string =>
  `<${tag}${Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("")}>`;

/**
 * `body` on its own lines inside `<tag>`: how a prompt hands the model text to read, never to
 * obey. Attribute values are written as given.
 */
export const xmlBlock = (
  tag: string,
  body: string,
  attributes: XmlAttributes = {}
): string => `${openTag(tag, attributes)}\n${body}\n</${tag}>`;

/** `<tag>value</tag>` on one line, for a short field. */
export const xmlField = (
  tag: string,
  value: string,
  attributes: XmlAttributes = {}
): string => `${openTag(tag, attributes)}${value}</${tag}>`;

/** A slash command's text; `$1`, `$2`, … take its arguments in order and `$ARGUMENTS` all of them. */
export interface PromptTemplate {
  name: string;
  description?: string;
  argumentHint?: string;
  content: string;
}

/** Detailed rules the model loads by name; the system prompt lists only names and descriptions. */
export interface Skill {
  name: string;
  /** When to use it; what the model sees in the skill index. */
  description: string;
  content: string;
}

export const formatPromptTemplateInvocation = (
  template: PromptTemplate,
  args: readonly string[] = []
): string =>
  template.content
    .replace(
      /\$(\d+)/g,
      (_, index: string) => args[Number.parseInt(index, 10) - 1] ?? ""
    )
    .replaceAll("$ARGUMENTS", args.join(" "));
