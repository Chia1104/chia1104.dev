import type { Skill } from "@earendil-works/pi-agent-core";

/**
 * Skills, in pi's first-class sense. The system prompt carries only name and description
 * (`formatSkillsIndex` in `system.ts`); the model loads `content` on demand through the
 * `read_skill` tool, which is the only read path — pi's default convention of reading the skill
 * file from disk has no tool to back it here.
 *
 * They live inline rather than as `SKILL.md` files on disk because this package is consumed
 * source-only (no build step) and is loaded inside a server bundle — a runtime `fs.readFile`
 * relative to `import.meta.url` would break under nitro's tracing. `filePath` is therefore a
 * stable synthetic id, which is all pi uses it for here.
 */

const skill = (name: string, description: string, content: string): Skill => ({
  name,
  description,
  content: content.trim(),
  filePath: `@chia/agent-writing/skills/${name}`,
});

export const mdxAuthoringSkill = skill(
  "mdx-authoring",
  "The MDX dialect and math/admonition syntax available in a post body. Read before writing or editing any body.",
  `
# MDX authoring

Post bodies are MDX compiled with \`remark-math\`, \`remark-directive-admonition\` and
\`rehype-katex\`. Standard Markdown works. Beyond it:

## Frontmatter — do NOT write any

Title, excerpt, description and summary are **structured metadata**, not frontmatter. Set them
with \`patch_draft_meta\`. A \`---\` block at the top of the body renders as literal text.

## Headings

Start at \`##\`. The page already renders the post title as the \`<h1>\`. Do not skip levels
(\`##\` → \`####\`) — the table of contents is generated from the heading tree.

## Admonitions

Directive syntax, not GitHub's \`> [!NOTE]\`:

\`\`\`
:::note
Body text.
:::

:::warning{title="Custom title"}
Body text.
:::
\`\`\`

Available kinds: \`note\`, \`tip\`, \`info\`, \`warning\`, \`danger\`.

## Math

Inline with single dollars, display with double:

\`\`\`
The complexity is $O(n \\log n)$.

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$
\`\`\`

## Code

Always tag the language — the highlighter needs it:

\`\`\`\`
\`\`\`ts
const x = 1;
\`\`\`
\`\`\`\`

## Links

Use site-absolute paths for internal links (\`/feed/some-slug\`) and full URLs for external
ones. **Relative paths (\`./x\`, \`../x\`) do not resolve** and are a validation error.

## JSX

Every JSX tag must be closed, including void elements (\`<br />\`, not \`<br>\`). An unclosed tag
is a compile error. Stick to Markdown unless you specifically need a component. Before adding or
editing one, load \`mdx-components\`; never import a component inside the post body.
`
);

export const mdxComponentsSkill = skill(
  "mdx-components",
  "The supported JSX components and exact authoring syntax for post MDX. Read before adding or editing any component markup; not needed for Markdown-only bodies.",
  `
# MDX components

Components are injected by the renderer. Use them directly — **never add \`import\` or \`export\`
statements to a post**. Component names are case-sensitive. Use only the catalog below; do not
invent a component from the wider Fumadocs library.

Ordinary headings, links, images, blockquotes, fenced code, tables and bold text already have site
renderers. Prefer their Markdown syntax unless a component below provides behavior Markdown cannot.

## Tabs

Use one \`Tab\` per item. Keep every \`value\` identical to its item label; explicit values are
more stable than index-based inference.

\`\`\`mdx
<Tabs items={["TypeScript", "JavaScript"]} defaultIndex={0}>
  <Tab value="TypeScript">

\`\`\`ts
const typed: string = "yes";
\`\`\`

  </Tab>
  <Tab value="JavaScript">

\`\`\`js
const typed = "no";
\`\`\`

  </Tab>
</Tabs>
\`\`\`

Use \`groupId="..."\` to synchronize related tab groups and add \`persist\` only when the selected
value should survive a reload.

## Callouts

For ordinary notes and warnings, prefer the directive syntax in \`mdx-authoring\`. Use \`Callout\`
when its explicit title or visual type is useful. Supported types are \`info\`, \`warn\`/
\`warning\`, \`error\`, \`success\` and \`idea\`.

\`\`\`mdx
<Callout type="idea" title="Why this works">
  The cache key includes both the input and the selected model.
</Callout>
\`\`\`

For custom multi-part content, the lower-level components are also available:

\`\`\`mdx
<CalloutContainer type="success">
  <CalloutTitle>Migration complete</CalloutTitle>
  <CalloutDescription>The new index is serving all reads.</CalloutDescription>
</CalloutContainer>
\`\`\`

## Accordions

Every \`Accordion\` must be inside \`Accordions\` and must have a \`title\`. Add a stable, unique
\`id\` when the section should be directly linkable. Use \`type="multiple"\` only when readers
need several items open at once; the default is a collapsible single item.

\`\`\`mdx
<Accordions>
  <Accordion title="Where is the cache stored?" id="cache-location">
    It is stored in Redis.
  </Accordion>
  <Accordion title="How is it invalidated?" id="cache-invalidation">
    Writes invalidate the matching key.
  </Accordion>
</Accordions>
\`\`\`

## Cards

Use \`Cards\` to group related destinations. \`Card\` requires \`title\`; \`href\` and
\`description\` are optional. Internal links must remain site-absolute.

\`\`\`mdx
<Cards>
  <Card title="Agent architecture" href="/feed/agent-architecture">
    How durable turns, tools and approvals fit together.
  </Card>
  <Card title="Source repository" href="https://github.com/chia1104" external>
    Browse the implementation.
  </Card>
</Cards>
\`\`\`

Do not add icon components: no icon library is injected into post MDX.

## File trees

Wrap every tree in \`Files\`. \`File\` and \`Folder\` require \`name\`; folders may be nested and
\`defaultOpen\` expands a folder initially.

\`\`\`mdx
<Files>
  <Folder name="src" defaultOpen>
    <Folder name="components">
      <File name="button.tsx" />
    </Folder>
    <File name="index.ts" />
  </Folder>
  <File name="package.json" />
</Files>
\`\`\`

## Type tables

\`TypeTable\` takes a \`type\` object keyed by field name. Every field requires \`type\` and may
include \`description\`, \`typeDescription\`, \`typeDescriptionLink\`, \`default\`, \`required\`,
\`deprecated\`, \`parameters\` or \`returns\`.

\`\`\`mdx
<TypeTable
  type={{
    enabled: {
      type: "boolean",
      description: "Enables the cache.",
      default: false,
    },
    key: {
      type: "string",
      description: "Stable cache key.",
      required: true,
    },
  }}
/>
\`\`\`

This is the hand-authored \`TypeTable\`, not \`AutoTypeTable\`; it cannot read a TypeScript file.

## Mermaid

Pass a complete Mermaid definition through the required \`chart\` string. Encode line breaks as
\`\\n\` inside the attribute. Keep node labels short and quote labels that contain punctuation.

\`\`\`mdx
<Mermaid chart="flowchart LR\\n  draft[Draft] --> review[Review]\\n  review --> publish[Publish]" />
\`\`\`

## Images and layout helpers

Markdown images and \`Image\` both render with the site's zoom behavior. Use \`Image\` when explicit
dimensions or a wrapper are needed. A string \`src\` must have numeric \`width\` and \`height\`, and
\`alt\` must describe the image (or be \`alt=""\` when purely decorative).

\`\`\`mdx
<Image
  src="/images/agent-turn.png"
  alt="Sequence diagram of a durable agent turn"
  width={1600}
  height={900}
/>
\`\`\`

The local helpers only control layout:

- \`ImageWrapper\`: full-width, positioned, rounded and clipped container.
- \`ImageWrapperWithMaxWidth\`: the same, capped at 250 px.
- \`FlexCenter\`: horizontally centers its child.

They may be composed when a small image needs centering:

\`\`\`mdx
<FlexCenter>
  <ImageWrapperWithMaxWidth>
    <Image src="/images/logo.png" alt="Project logo" width={250} height={250} />
  </ImageWrapperWithMaxWidth>
</FlexCenter>
\`\`\`

## Banner

\`Banner\` is a site-announcement component and should be rare inside an article. Always set
\`changeLayout={false}\` in post MDX so it does not modify the page layout. Add a stable \`id\` only
when readers should be able to dismiss it; their dismissal is persisted. \`variant="rainbow"\` is
the only alternative to the normal style.

\`\`\`mdx
<Banner id="outdated-api-notice" changeLayout={false}>
  This article covers the v1 API.
</Banner>
\`\`\`

## Compiler-facing components

\`CodeBlockTab\`, \`CodeBlockTabs\`, \`CodeBlockTabsList\` and \`CodeBlockTabsTrigger\` exist for
Fumadocs code-tab output. Do not author them manually; use \`Tabs\`/\`Tab\` around fenced code.

No other named JSX components are available. In particular, do not use \`Steps\`, \`Step\`,
\`AutoTypeTable\` or arbitrary icon components unless the renderer is changed first.
`
);

export const zhTwToneSkill = skill(
  "zh-tw-tone",
  "Voice, punctuation and spacing rules for Traditional Chinese (zh-TW) posts.",
  `
# zh-TW voice

Traditional Chinese, Taiwan conventions. Never Simplified.

## Register

Write like an engineer explaining something to a colleague: direct, concrete, unhurried.
Avoid marketing register ("強大的", "令人驚豔的") and avoid the machine-translated feel of long
subordinate chains. Short sentences win.

## Punctuation

Use full-width punctuation: 。，、；：（）「」. Reserve half-width \`()\` for code.
No spaces before full-width punctuation.

## Mixed script spacing

One half-width space between CJK and Latin/digits: \`使用 TypeScript 5.9 改寫\`.
No space between CJK and full-width punctuation.

## Technical terms

Keep the English term when that is what people say (\`build\`, \`deploy\`, \`race condition\`).
Do not invent Chinese translations for API names, flags or type names. Where a Chinese term is
standard, use it (\`型別\` not \`類型\` for types, \`相依\` for dependency).

## Pronouns

Address the reader as 你, not 您 — this is a personal blog, not a manual.
`
);

export const enToneSkill = skill(
  "en-tone",
  "Voice and style rules for English (en) posts.",
  `
# English voice

## Register

Plain, technical, first-person-singular where it helps. Short sentences. Active voice.
No marketing adjectives, no "delve", no "it's worth noting that", no rhetorical questions as
section openers.

## Structure

Lead with the conclusion, then explain. A reader who stops after the first paragraph should
still have learned the main point.

## Terminology

American spelling. Code identifiers in backticks, exactly as they appear in the source.
Expand an acronym on first use unless it is universally known (API, HTTP, JSON).

## Bilingual parity

If a zh-TW version of the same post exists, this is a **rewrite**, not a translation: keep the
same structure, headings and code, but let the prose read as though it were written in English
first. Never leave a sentence that reads as translated.
`
);

export const seoMetadataSkill = skill(
  "seo-metadata",
  "Rules and length limits for slug, excerpt, description and summary.",
  `
# Metadata

Four per-locale fields, each with a distinct job. Do not paste the same text into more than one.

## \`title\`

Required. The real subject of the post, not a teaser. No trailing site name.

## \`excerpt\`

1–2 sentences, shown under the title in post listings. Says what the reader will get.
Written for a human browsing a list.

## \`description\`

SEO meta description. **Hard limit 160 characters** — it is truncated beyond that.
Front-load the distinguishing keywords. One sentence, no ellipsis.

## \`summary\`

3–5 sentences. A standalone abstract for someone deciding whether to read the whole thing, and
the text used for semantic search embeddings — so it should be dense with the concepts the post
actually covers, not a hook.

## \`slug\`

Lowercase, hyphenated, English even for zh-TW posts, and stable — changing it breaks inbound
links. \`patch_draft_meta\` normalises what you pass and echoes the result; \`slugify\` exists to
compare candidates before you choose. Keep it short: 3–6 words. Omit stop words.
`
);

export const bilingualParitySkill = skill(
  "bilingual-parity",
  "How to keep the zh-TW and en versions of a post in sync.",
  `
# Bilingual parity

A post can carry a translation per locale. \`defaultLocale\` marks the canonical one.

## Rules

1. **Structure must match.** Same heading tree, same code blocks, same admonitions, same order.
   A reader switching locales should land in the same place.
2. **Code is never translated.** Identical snippets, identical identifiers. Comments inside code
   may be translated; the code may not.
3. **Prose is rewritten, not translated.** Read the source paragraph, understand it, write it
   again in the target language. Sentence counts will differ. That is correct.
4. **Metadata is per-locale.** Write a real \`excerpt\`, \`description\` and \`summary\` for each —
   never reuse the other locale's, and never leave them empty.
5. **The slug is shared.** One slug for the whole post, regardless of locale.

## Workflow

Finish the default locale first. Then write the second locale. Do not interleave — half-written
locales are hard to compare.
`
);

export const writingSkills: Skill[] = [
  mdxAuthoringSkill,
  mdxComponentsSkill,
  zhTwToneSkill,
  enToneSkill,
  seoMetadataSkill,
  bilingualParitySkill,
];
