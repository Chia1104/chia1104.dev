import type { PromptTemplate } from "@earendil-works/pi-agent-core";

/**
 * Prompt templates, invoked with `engine.promptFromTemplate(name, args)`.
 *
 * These are the dashboard's slash commands. `$1`, `$2`, `$ARGUMENTS` are substituted by pi's
 * `substituteArgs`, so the argument order below is the contract with the UI.
 */

const template = (
  name: string,
  description: string,
  content: string
): PromptTemplate => ({ name, description, content: content.trim() });

export const newPostTemplate = template(
  "new-post",
  "Draft a new post from a topic. Usage: /new-post <topic>",
  `
Write a new post about: $ARGUMENTS

Work in this order:

1. \`search_posts\` for the topic. If something close already exists, stop and tell me — we
   should update that post instead of adding a near-duplicate.
2. Read the \`mdx-authoring\` and \`seo-metadata\` skills.
3. Decide the default locale (zh-TW unless the topic is clearly English-first) and set the
   feed metadata: \`type\`, \`slug\` (run \`slugify\` first), \`defaultLocale\`.
4. Write the body for the default locale, then set its title, excerpt, description and summary.
5. Stop and show me a summary. Do NOT commit — I will tell you when.
`
);

export const translateTemplate = template(
  "translate",
  "Add or refresh another locale for the current draft. Usage: /translate <locale>",
  `
Produce the $1 version of the current draft.

Read the \`bilingual-parity\` skill first, then the tone skill for $1. This is a rewrite, not a
translation: same structure, same code, prose that reads as though written in $1 originally.

Write real per-locale metadata — do not copy the other locale's.
`
);

export const seoPassTemplate = template(
  "seo-pass",
  "Review and improve metadata for every locale of the current draft.",
  `
Do a metadata pass over every locale of the current draft.

Read the \`seo-metadata\` skill. For each locale: read the draft, then judge whether the title,
excerpt, description and summary each do their distinct job. Rewrite the ones that do not.
Check the description length. Make sure the slug is short, stable and descriptive.

Report what you changed and why, per locale. Do not touch the body.
`
);

export const rewriteSectionTemplate = template(
  "rewrite-section",
  "Rewrite one section of the draft. Usage: /rewrite-section <heading> [instruction]",
  `
Rewrite the section under the heading "$1" in the current draft.

Additional instruction: $2

Read the draft first so your \`edit_draft_content\` call matches exactly. Change only that
section — leave every other line byte-identical.
`
);

export const factCheckTemplate = template(
  "fact-check",
  "Verify the factual and technical claims in the current draft.",
  `
Fact-check the current draft.

List every checkable claim: version numbers, API names and signatures, benchmark figures,
historical statements, quoted behaviour. For each, find the primary source with
\`web_search\` if you do not already know its URL, then read it with \`fetch_url\` — official
docs, release notes, the actual repository, not blog posts.

Report a table of claim / verdict / source URL. For anything wrong or unverifiable, propose the
exact correction but do NOT edit the draft until I confirm.
`
);

export const writingPromptTemplates: PromptTemplate[] = [
  newPostTemplate,
  translateTemplate,
  seoPassTemplate,
  rewriteSectionTemplate,
  factCheckTemplate,
];
