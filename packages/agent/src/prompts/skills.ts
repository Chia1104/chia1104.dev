import type { Skill } from "@earendil-works/pi-agent-core";

/**
 * Skills, in pi's first-class sense: `formatSkillsForSystemPrompt` inserts the name and
 * description into the system prompt, and the model pulls the full `content` in on demand via
 * `harness.skill(name)`.
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
  filePath: `@chia/agent/skills/${name}`,
});

export const mdxAuthoringSkill = skill(
  "mdx-authoring",
  "The MDX dialect, components and math/admonition syntax available in a post body. Read before writing or editing any body.",
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
is a compile error. Stick to Markdown unless you specifically need a component — if
\`validate_draft\` reports an unknown component, remove it rather than guessing at a
replacement.
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
links. Call \`slugify\` to see the normalised form before setting it. Keep it short: 3–6 words.
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

Finish and validate the default locale first. Then write the second locale, then run
\`validate_draft\` for it too. Do not interleave — half-written locales are hard to compare.
`
);

export const writingSkills: Skill[] = [
  mdxAuthoringSkill,
  zhTwToneSkill,
  enToneSkill,
  seoMetadataSkill,
  bilingualParitySkill,
];
