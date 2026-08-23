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
  "The MDX dialect, math, code, links and JSX constraints for a post body. Read before writing or editing any body.",
  `
# MDX authoring

Post bodies are MDX compiled with \`remark-math\` and \`rehype-katex\`. Standard Markdown works.
Beyond it:

## Frontmatter — do NOT write any

Title, excerpt, description and summary are **structured metadata**, not frontmatter. Set them
with \`patch_draft_meta\`. A \`---\` block at the top of the body renders as literal text.

## Headings

Start at \`##\`. The page already renders the post title as the \`<h1>\`. Do not skip levels
(\`##\` → \`####\`) — the table of contents is generated from the heading tree.

## Callouts

Directive admonitions such as \`:::note\` and GitHub alerts such as \`> [!NOTE]\` are **not
supported**. Load \`mdx-components\` and use its \`Callout\` component instead.

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

Directive admonitions such as \`:::note\` and GitHub alerts such as \`> [!NOTE]\` are not
supported. Use \`Callout\` for every note, warning or aside. Supported types are \`info\`,
\`warn\`/\`warning\`, \`error\`, \`success\` and \`idea\`.

Use \`type="info"\` for an ordinary note:

\`\`\`mdx
<Callout type="info">
  Logs compare expected and actual behavior; each record should eliminate a hypothesis.
</Callout>
\`\`\`

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

export const noAiSlopSkill = skill(
  "no-ai-slop",
  "Audit or revise staged blog prose to remove AI-sounding patterns while preserving the author's voice. Read when asked to make a draft more human, direct or opinionated, or to assess AI slop; not required for ordinary drafting.",
  `
# No AI slop

Edit like a sharp human editor. Preserve the author's point and recognizable voice while removing
generic AI patterns. Do not turn distinctive writing into uniformly polished prose. Load the
locale's tone skill too; this skill does not replace \`zh-tw-tone\` or \`en-tone\`.

## Two modes

**Edit (default).** Make the minimum effective changes in the staging draft. Fix AI patterns,
errors, repetition and unclear passages. Leave strong human sentences alone.

**Detect.** When asked to audit, scan or flag without rewriting, name each pattern below, quote the
line and give a short fix. Do not change the staging draft, assign a score, use an AI detector or
guess who wrote the text. Observable patterns are the evidence.

## Workflow in this agent

1. Call \`read_draft\` with the target locale and read the entire body before judging it. If there
   is no body, ask the operator what should be reviewed.
2. Identify the core point and 3–5 voice signals to preserve: vocabulary, cadence, bluntness,
   humor, uncertainty, digressions or roughness. Keep this note internal.
3. In Detect mode, report the findings and stop.
4. In Edit mode, use targeted \`edit_draft_content\` calls. Do not replace the whole body merely
   to make it consistent, especially after the operator has reviewed it.
5. Read the edited locale again and run the final check below. Fix every failed check before
   handing back the draft.
6. Summarize what changed and why. Mention any larger reordering explicitly.

If the core point, intended reader or desired effect is genuinely unclear, ask one focused question
before editing. Do not ask for information the current draft or session already provides.

## Editing principles

- Preserve meaning, useful uncertainty and the author's actual opinions. Never invent a claim,
  example, number, quote or stronger conclusion.
- Make the minimum effective edit. A rough passage with personality should still sound like the
  same person afterward.
- Lead with the point when setup adds nothing, but keep an aside, story or admission that creates
  context, tension or character.
- Protect concrete facts. Names, numbers, dates, mechanisms, consequences and examples must not be
  smoothed into generic importance.
- Prefer direct verbs and clear subjects. Split genuinely tangled sentences without flattening a
  clear spoken cadence or turning every sentence into the same shape.
- Apply the portability test: if a sentence could move unchanged to another person, product or
  company, it is probably filler. Cut it or make it specific using facts already in the draft.
- Show the evidence instead of telling the reader that something is important, surprising,
  subtle or obvious. Trust the reader when the surrounding prose already proves the point.
- Preserve useful edge: blunt language, humor, profanity, self-interruptions and honest admissions
  belong when they are part of the author's voice.
- Keep the existing progression and detours unless they make the piece harder to understand.

## Words and phrases to cut

In English prose, remove these unless they are quoted or technically necessary: \`delve\`,
\`foster\`, \`leverage\`, \`utilize\`, \`facilitate\`, \`empower\`, \`streamline\`, \`robust\`,
\`cutting-edge\`, \`paradigm shift\`, \`game changer\`, \`this is huge\`,
\`this changes everything\`, \`tapestry\`, \`realm\`, \`beacon\`, \`multifaceted\`,
\`meticulous\`, \`intricate\`, \`paramount\`, \`transformative\`, \`elevate\`, \`embark\`,
\`supercharge\`, \`harness\`, \`ever-evolving\`.

Cut empty qualifiers only when they add nothing: \`just\`, \`literally\`, \`honestly\`, \`simply\`,
\`actually\`, \`truly\`, \`fundamentally\`, \`importantly\`, \`crucially\`, \`inherently\`,
\`inevitably\`. Keep one when it carries real emphasis, uncertainty, contrast or spoken rhythm.

Cut throat-clearing phrases such as \`it's worth noting\`, \`at the end of the day\`,
\`when it comes to\`, \`at its core\`, \`in today's world\`, \`the reality is\`, \`in terms of\`,
\`in order to\`, \`going forward\`, \`in this article\` and \`let's dive in\`.

Apply the same functional test in zh-TW. Common filler includes「值得注意的是」、「至關重要」、
「在這個日新月異的時代」、「讓我們深入探討」、「不僅是 X，更是 Y」，以及只說
「這一點很重要」而沒有交代後果的句子。

## Patterns to cut

- **Binary contrasts / negative listing:** \`This is not X. It is Y.\`, \`not just X but Y\` or
  \`Not X. Not Y. Z.\` State Y or Z directly.
- **Throat-clearing openers:** \`Here is the thing\`, \`Let me be clear\`, \`I will be honest\` or
  \`The uncomfortable truth is\`. Start with the point unless the admission carries real voice.
- **Faux-insight setups:** \`What most people get wrong\`, \`Here is what nobody tells you\` or
  \`The part everyone misses\`. Remove the self-flattery and make the claim stand on its own.
- **Colon reveals:** a noun phrase followed by a dramatic lowercase reveal, such as
  \`The detail that makes it work: a separate agent grades it.\` Rewrite it as a plain sentence.
  Keep colons for lists, labels and quotes.
- **Superficial analysis:** trailing \`-ing\` clauses with \`highlighting\`, \`underscoring\`,
  \`reflecting\` or \`showcasing\` that label significance instead of explaining a consequence.
- **Importance puffery:** \`marks a pivotal moment\`, \`plays a vital role\`,
  \`stands as a testament\` or \`underscores its significance\`. State the concrete fact.
- **Interpretive metadiscourse:** \`The key point is\`, \`As you can see\`,
  \`This distinction matters\`, \`That matters more than it sounds\` or redundant
  \`In other words\`. Delete it or replace it with missing support.
- **Weasel attribution:** \`experts agree\`, \`studies show\`, \`many argue\` or
  \`widely regarded as\`. Name the source or cut the claim; never invent one.
- **Fake-strong verbs:** prefer \`is\` and \`has\` when clearer. Replace \`serves as a hub\` with
  what the product actually tracks or does.
- **Synonym cycling:** do not rotate \`agent\`, \`assistant\` and \`tool\` for style when they mean
  the same thing. Repeat the accurate term.
- **Dramatic fragmentation / robotic rhythm:** avoid stacked fragments, repeated sentence shapes,
  identical paragraph structures and \`X. And Y. And Z.\` Vary cadence only when it helps the point.
- **Rhetorical setups:** \`What if I told you\`, \`Think about it\`, \`Plot twist\` and self-answered
  question/answer pairs. State the answer directly.
- **Fake-profound kickers:** delete the final cute metaphor, aphorism or mic-drop line. End on the
  clearest concrete point, takeaway or next action already supported by the draft.
- **Summary-recap endings:** cut \`In conclusion\`, \`Ultimately\`, \`Overall\` and final paragraphs
  that merely repeat what the reader just read.
- **Formatting slop:** no emoji headings, decorative bold inside sentences, bullets that should be
  two sentences of prose or headings over tiny sections.
- **Em-dash clusters:** use none in short copy and at most 1–2 in a longer English draft when they
  clearly beat a comma, period or parentheses. Do not add them as a rhythm preset.

## Final check

Before handing back an edit, verify all of these:

1. The point and factual claims are unchanged; nothing was invented.
2. The author's vocabulary, cadence, edge, uncertainty and useful roughness remain recognizable.
3. Strong human sentences were left alone, and the amount of cutting matches the actual slop.
4. Generic lines fail neither the portability test nor the show-don't-tell test.
5. Direct verbs, concrete details and clear subjects replaced abstraction only where supported.
6. The named patterns, filler and formatting slop above are gone without creating robotic symmetry.
7. The ending lands on a concrete point or action rather than a recap or fake-profound kicker.
8. The result sounds natural when read to a sharp colleague.
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
links. Choose the English wording yourself, then pass it to \`patch_draft_meta\`; normalization only
lowercases and hyphenates it, and never translates a localized title. Keep it short: 3–6 words.
Omit stop words.
`
);

export const bilingualParitySkill = skill(
  "bilingual-parity",
  "How to keep the zh-TW and en versions of a post in sync.",
  `
# Bilingual parity

A post can carry a translation per locale. \`defaultLocale\` marks the canonical one.

## Rules

1. **Structure must match.** Same heading tree, same code blocks, same callouts, same order.
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
  noAiSlopSkill,
  seoMetadataSkill,
  bilingualParitySkill,
];
