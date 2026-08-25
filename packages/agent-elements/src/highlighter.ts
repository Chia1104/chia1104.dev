import type { BundledLanguage, Highlighter } from "shiki";
import { bundledLanguagesInfo, createHighlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type { Highlighter };

/** Token colours are emitted for both and resolved with `light-dark()` from the page's `color-scheme`. */
export const themes = { light: "github-light", dark: "github-dark" } as const;

const languageIds = new Map<string, BundledLanguage>();
for (const info of bundledLanguagesInfo) {
  /* SAFETY: bundledLanguagesInfo enumerates exactly the ids that make up BundledLanguage. */
  const id = info.id as BundledLanguage;
  languageIds.set(id, id);
  for (const alias of info.aliases ?? []) languageIds.set(alias, id);
}

/** Shiki's `text` grammar: tokens without scopes, so unknown languages still stream. */
export const PLAIN = "text";

export const resolveLanguage = (
  language: string
): BundledLanguage | typeof PLAIN =>
  languageIds.get(language.trim().toLowerCase()) ?? PLAIN;

let highlighter: Promise<Highlighter> | undefined;

/**
 * One highlighter for the whole app; the JS engine is used so no wasm has to ship, `forgiving`
 * because a few bundled grammars use regex features the JS engine cannot compile.
 */
const getHighlighter = () =>
  (highlighter ??= createHighlighter({
    themes: [themes.light, themes.dark],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  }));

const loading = new Map<string, Promise<void>>();

/** Resolves once the grammar for `language` is registered, so tokenizing can start synchronously. */
export const loadLanguage = async (language: string) => {
  const id = resolveLanguage(language);
  const instance = await getHighlighter();
  if (id !== PLAIN && !instance.getLoadedLanguages().includes(id)) {
    let pending = loading.get(id);
    if (!pending) {
      pending = instance.loadLanguage(id).finally(() => loading.delete(id));
      loading.set(id, pending);
    }
    await pending;
  }
  return { highlighter: instance, language: id };
};
