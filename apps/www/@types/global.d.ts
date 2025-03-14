import type { formats } from "@/i18n/request";
import type { routing } from "@/i18n/routing";

import type en_us from "../messages/en-US.json";
import type zh_tw from "../messages/zh-TW.json";

type Messages = typeof en_us & typeof zh_tw;

declare module "next-intl" {
  interface AppConfig {
    Messages: Messages;
    Formats: typeof formats;
  }

  interface AppConfig {
    // ...
    Locale: (typeof routing.locales)[number];
  }
}
