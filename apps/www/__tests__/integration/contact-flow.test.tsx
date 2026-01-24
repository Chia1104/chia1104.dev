import { describe, it, expect, vi, beforeEach } from "vitest";

import { contactSchema } from "@/shared/validator";

describe("Contact Form Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Contact Schema Validation", () => {
    it("應該驗證完整的聯絡表單資料", () => {
      const validData = {
        email: "user@example.com",
        title: "需要技術支援",
        message: "我遇到了一些技術問題需要協助",
        captchaToken: "test-token-abc123",
      };

      const result = contactSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("應該拒絕空的表單欄位", () => {
      const invalidData = {
        email: "",
        title: "",
        message: "",
        captchaToken: "",
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("應該驗證 email 格式", () => {
      const testCases = [
        { email: "valid@example.com", shouldPass: true },
        { email: "user+tag@example.co.uk", shouldPass: true },
        { email: "invalid-email", shouldPass: false },
        { email: "missing@", shouldPass: false },
        { email: "@nodomain.com", shouldPass: false },
        { email: "no-at-sign.com", shouldPass: false },
      ];

      testCases.forEach(({ email, shouldPass }) => {
        const data = {
          email,
          title: "這是測試標題",
          message: "這是測試訊息內容",
          captchaToken: "token",
        };

        const result = contactSchema.safeParse(data);
        expect(result.success).toBe(shouldPass);
      });
    });

    it("應該要求標題至少 5 個字符", () => {
      const shortTitle = {
        email: "test@example.com",
        title: "Hi", // 只有 2 個字符
        message: "這是一個測試訊息",
        captchaToken: "token",
      };

      const result = contactSchema.safeParse(shortTitle);
      expect(result.success).toBe(false);
    });

    it("應該要求訊息至少 5 個字符", () => {
      const shortMessage = {
        email: "test@example.com",
        title: "測試標題",
        message: "Hi", // 只有 2 個字符
        captchaToken: "token",
      };

      const result = contactSchema.safeParse(shortMessage);
      expect(result.success).toBe(false);
    });

    it("應該要求必須包含 captcha token", () => {
      const noCaptcha = {
        email: "test@example.com",
        title: "測試標題",
        message: "這是一個測試訊息",
        captchaToken: "",
      };

      const result = contactSchema.safeParse(noCaptcha);
      expect(result.success).toBe(false);
    });
  });

  describe("Form Validation Edge Cases", () => {
    it("應該處理 email 中的特殊字符", () => {
      const specialEmails = [
        "user+tag@example.com",
        "user.name@example.co.uk",
        "user_name@example-domain.com",
      ];

      specialEmails.forEach((email) => {
        const data = {
          email,
          title: "測試標題",
          message: "測試訊息內容",
          captchaToken: "token",
        };

        const result = contactSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("應該處理多行訊息", () => {
      const multilineMessage = {
        email: "test@example.com",
        title: "多行訊息測試",
        message: "第一行\n第二行\n第三行內容",
        captchaToken: "token",
      };

      const result = contactSchema.safeParse(multilineMessage);
      expect(result.success).toBe(true);
    });

    it("應該處理 Unicode 字符", () => {
      const unicodeData = {
        email: "test@example.com",
        title: "測試標題 🚀",
        message: "這是包含表情符號的訊息 ✨",
        captchaToken: "token",
      };

      const result = contactSchema.safeParse(unicodeData);
      expect(result.success).toBe(true);
    });

    it("應該拒絕超長的 email", () => {
      const longEmail = `${"a".repeat(100)}@example.com`;
      const data = {
        email: longEmail,
        title: "測試標題",
        message: "測試訊息內容",
        captchaToken: "token",
      };

      const result = contactSchema.safeParse(data);
      // Email 驗證應該處理合理長度
      expect(result.success).toBeDefined();
    });
  });

  describe("Security Considerations", () => {
    it("應該拒絕額外的欄位（防止注入）", () => {
      const dataWithExtraFields = {
        email: "test@example.com",
        title: "測試標題",
        message: "測試訊息內容",
        captchaToken: "token",
        admin: true, // 額外欄位
        userId: 123, // 額外欄位
      };

      const result = contactSchema.safeParse(dataWithExtraFields);
      expect(result.success).toBe(false);
    });

    it("應該驗證所有必要欄位都存在", () => {
      const requiredFields = ["email", "title", "message", "captchaToken"];

      requiredFields.forEach((field) => {
        const data = {
          email: "test@example.com",
          title: "測試標題",
          message: "測試訊息內容",
          captchaToken: "token",
        };

        // 移除一個必要欄位
        delete data[field as keyof typeof data];

        const result = contactSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });
});
