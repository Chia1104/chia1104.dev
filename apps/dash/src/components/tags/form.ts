import type * as z from "zod";

import { Locale } from "@chia/db/types";
import { tagWriteSchema } from "@chia/db/validator/tags";

import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

export type TagView = RouterOutputs["tags"]["list"]["items"][number];
export type TagWrite = RouterInputs["tags"]["create"];

export const LOCALES: readonly Locale[] = [Locale.ZhTW, Locale.En];

export const LOCALE_LABEL = {
  [Locale.ZhTW]: "中文",
  [Locale.En]: "English",
} satisfies Record<Locale, string>;

/** The form edits the write payload as is; a blank description becomes `null` in the schema. */
export const tagFormSchema = tagWriteSchema;

export type TagFormInput = z.input<typeof tagFormSchema>;
export type TagFormOutput = z.output<typeof tagFormSchema>;

const emptyTranslation = () => ({ name: "", description: "" });

export const emptyFormValues = (): TagFormInput => ({
  slug: "",
  translations: {
    [Locale.ZhTW]: emptyTranslation(),
    [Locale.En]: emptyTranslation(),
  },
});

export const formValuesOf = (tag: TagView): TagFormInput => ({
  slug: tag.slug,
  translations: {
    [Locale.ZhTW]: {
      name: tag.translations[Locale.ZhTW]?.name ?? "",
      description: tag.translations[Locale.ZhTW]?.description ?? "",
    },
    [Locale.En]: {
      name: tag.translations[Locale.En]?.name ?? "",
      description: tag.translations[Locale.En]?.description ?? "",
    },
  },
});

export const nameOf = (tag: TagView, locale: Locale = Locale.ZhTW): string =>
  tag.translations[locale]?.name ?? tag.slug;
