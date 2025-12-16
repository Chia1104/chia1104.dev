import type en_us from "@chia/i18n/www/en-US.json";
import type zh_tw from "@chia/i18n/www/zh-TW.json";

import type { formats } from "@/i18n/request";
import type { routing } from "@/i18n/routing";

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
