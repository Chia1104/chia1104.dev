"use server";

import { cookies } from "next/headers";

import { DEFAULT_LOCALE, I18N } from "@/utils/i18n";

// In this example the locale is read from a cookie. You could alternatively
// also read it from a database, backend service, or any other source.
const COOKIE_NAME = "NEXT_LOCALE";

export async function getUserLocale() {
  return (await cookies()).get(COOKIE_NAME)?.value || DEFAULT_LOCALE;
}

export async function setUserLocale(locale: I18N) {
  (await cookies()).set(COOKIE_NAME, locale);
}
