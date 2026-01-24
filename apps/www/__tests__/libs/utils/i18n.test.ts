import { describe, it, expect } from "vitest";

import { Locale } from "@/libs/utils/i18n";

describe("i18n Utils", () => {
  describe("Locale", () => {
    it("應該定義正確的 locale 常數", () => {
      expect(Locale.EN).toBe("en-US");
      expect(Locale.ZH_TW).toBe("zh-TW");
    });

    it("應該有正確的 locale 型別", () => {
      const enLocale: Locale = Locale.EN;
      const zhTWLocale: Locale = Locale.ZH_TW;

      expect(enLocale).toBe("en-US");
      expect(zhTWLocale).toBe("zh-TW");
    });
  });
});
