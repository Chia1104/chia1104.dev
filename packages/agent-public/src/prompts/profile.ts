import type { ProfileEntrySnapshot } from "@chia/agent-content/types";
import { Locale, ProfileEntryKind } from "@chia/db/types";

/**
 * Renders the published profile as the `About the author` block of the system prompt. One
 * locale only: the model translates for the visitor, and both would double the prefix.
 */

/** Same order of magnitude as operator instructions; a résumé that outgrows this loses bodies, not entries. */
export const PROFILE_BRIEF_MAX_CHARS = 12_000;

export interface RenderProfileBriefOptions {
  locale: Locale;
  maxChars?: number;
}

interface Translation {
  title: string;
  summary?: string;
  content?: string;
}
type Translations = Partial<Record<Locale, Translation>>;

const SECTION_ORDER = [
  ProfileEntryKind.Experience,
  ProfileEntryKind.Education,
  ProfileEntryKind.Project,
] as const;

const SECTION_HEADING = {
  [ProfileEntryKind.Experience]: "## Experience",
  [ProfileEntryKind.Education]: "## Education",
  [ProfileEntryKind.Project]: "## Projects",
} satisfies Record<(typeof SECTION_ORDER)[number], string>;

const otherLocale = (locale: Locale): Locale =>
  locale === Locale.zhTW ? Locale.En : Locale.zhTW;

const translationOf = (
  translations: Translations,
  locale: Locale
): Translation | undefined =>
  translations[locale] ?? translations[otherLocale(locale)];

const periodOf = (data: { startDate?: string; endDate?: string }) =>
  data.startDate === undefined
    ? null
    : `${data.startDate} – ${data.endDate ?? "present"}`;

interface Item {
  /** Heading and one-line facts; always kept. */
  head: string;
  /** Markdown body; the first thing dropped under budget. */
  body: string | null;
}

const itemOf = (entry: ProfileEntrySnapshot, locale: Locale): Item | null => {
  const translation = translationOf(entry.data.translations, locale);
  if (!translation) return null;

  const facts: string[] = [];
  let title = translation.title;
  switch (entry.kind) {
    case ProfileEntryKind.About:
      break;
    case ProfileEntryKind.Experience:
      title = `${translation.title} · ${entry.data.organization}`;
      if (entry.data.location) facts.push(entry.data.location);
      if (entry.data.stack.length > 0)
        facts.push(`Stack: ${entry.data.stack.join(", ")}`);
      break;
    case ProfileEntryKind.Education:
      title = `${translation.title} · ${entry.data.organization}`;
      break;
    case ProfileEntryKind.Project:
      if (entry.data.url) facts.push(entry.data.url);
      if (entry.data.repository) facts.push(`Source: ${entry.data.repository}`);
      if (entry.data.stack.length > 0)
        facts.push(`Stack: ${entry.data.stack.join(", ")}`);
      break;
  }
  const period =
    entry.kind === ProfileEntryKind.About ? null : periodOf(entry.data);
  const heading = period ? `### ${title} (${period})` : `### ${title}`;

  const head = [
    heading,
    translation.summary ?? null,
    facts.length > 0 ? facts.join(" · ") : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { head, body: translation.content ?? null };
};

const render = (
  sections: { heading: string | null; items: Item[] }[],
  withBody: ReadonlySet<Item>
): string =>
  sections
    .map(({ heading, items }) =>
      [
        heading,
        ...items.map((item) =>
          withBody.has(item) && item.body !== null
            ? `${item.head}\n\n${item.body}`
            : item.head
        ),
      ]
        .filter((part): part is string => part !== null)
        .join("\n\n")
    )
    .join("\n\n");

/** `null` when nothing is published, so the prompt gets no section rather than an empty one. */
export const renderProfileBrief = (
  entries: readonly ProfileEntrySnapshot[],
  options: RenderProfileBriefOptions
): string | null => {
  const maxChars = options.maxChars ?? PROFILE_BRIEF_MAX_CHARS;

  const about = entries
    .filter((entry) => entry.kind === ProfileEntryKind.About)
    .slice(0, 1);
  const sections = [
    { heading: null, kinds: about },
    ...SECTION_ORDER.map((kind) => ({
      heading: SECTION_HEADING[kind],
      kinds: entries.filter((entry) => entry.kind === kind),
    })),
  ]
    .map(({ heading, kinds }) => ({
      heading,
      items: kinds
        .map((entry) => itemOf(entry, options.locale))
        .filter((item): item is Item => item !== null),
    }))
    .filter(({ items }) => items.length > 0);

  if (sections.length === 0) return null;

  // Bodies go last-item-first so the newest roles keep their detail longest.
  const items = sections.flatMap((section) => section.items);
  const withBody = new Set(items);
  let text = render(sections, withBody);
  for (
    let index = items.length - 1;
    text.length > maxChars && index >= 0;
    index -= 1
  ) {
    const item = items[index];
    if (item === undefined || item.body === null) continue;
    withBody.delete(item);
    text = render(sections, withBody);
  }
  return text.length > maxChars ? text.slice(0, maxChars) : text;
};
