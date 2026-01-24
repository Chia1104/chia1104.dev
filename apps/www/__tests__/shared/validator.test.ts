import { describe, it, expect } from "vitest";

import { emailSchema, contactSchema } from "@/shared/validator";

describe("Validator", () => {
  describe("emailSchema", () => {
    it("應該接受有效的 email", () => {
      const validEmails = [
        "test@example.com",
        "user.name@example.co.uk",
        "user+tag@domain.com",
        "test123@test-domain.com",
      ];

      validEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).not.toThrow();
      });
    });

    it("應該拒絕無效的 email", () => {
      const invalidEmails = [
        "notanemail",
        "@example.com",
        "user@",
        "user @example.com",
        "user@.com",
        "",
      ];

      invalidEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).toThrow();
      });
    });
  });

  describe("contactSchema", () => {
    it("應該接受有效的 contact 資料", () => {
      const validContact = {
        email: "test@example.com",
        title: "Test Title",
        message: "This is a test message",
        captchaToken: "test-token-123",
      };

      expect(() => contactSchema.parse(validContact)).not.toThrow();
      const result = contactSchema.parse(validContact);
      expect(result).toEqual(validContact);
    });

    it("應該拒絕過短的 title", () => {
      const invalidContact = {
        email: "test@example.com",
        title: "Hi", // 少於 5 個字符
        message: "This is a test message",
        captchaToken: "test-token-123",
      };

      expect(() => contactSchema.parse(invalidContact)).toThrow();
    });

    it("應該拒絕過短的 message", () => {
      const invalidContact = {
        email: "test@example.com",
        title: "Test Title",
        message: "Hi", // 少於 5 個字符
        captchaToken: "test-token-123",
      };

      expect(() => contactSchema.parse(invalidContact)).toThrow();
    });

    it("應該拒絕缺少 captchaToken", () => {
      const invalidContact = {
        email: "test@example.com",
        title: "Test Title",
        message: "This is a test message",
        captchaToken: "", // 空字符串
      };

      expect(() => contactSchema.parse(invalidContact)).toThrow();
    });

    it("應該拒絕無效的 email", () => {
      const invalidContact = {
        email: "invalid-email",
        title: "Test Title",
        message: "This is a test message",
        captchaToken: "test-token-123",
      };

      expect(() => contactSchema.parse(invalidContact)).toThrow();
    });

    it("應該拒絕額外的欄位（strictObject）", () => {
      const invalidContact = {
        email: "test@example.com",
        title: "Test Title",
        message: "This is a test message",
        captchaToken: "test-token-123",
        extraField: "should not be here", // 額外欄位
      };

      expect(() => contactSchema.parse(invalidContact)).toThrow();
    });

    it("應該拒絕缺少必要欄位", () => {
      const invalidContact = {
        email: "test@example.com",
        title: "Test Title",
        // missing message
        captchaToken: "test-token-123",
      };

      expect(() => contactSchema.parse(invalidContact)).toThrow();
    });
  });
});
