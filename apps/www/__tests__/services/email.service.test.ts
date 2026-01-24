import { describe, it, expect, vi, beforeEach } from "vitest";

import { X_CAPTCHA_RESPONSE } from "@chia/api/captcha";

import { client } from "@/libs/service/client";
import { HonoRPCError } from "@/libs/service/error";
import { sendEmail } from "@/services/email.service";

// Mock the client
vi.mock("@/libs/service/client", () => ({
  client: {
    api: {
      v1: {
        email: {
          send: {
            $post: vi.fn(),
          },
        },
      },
    },
  },
}));

// 取得 mock 函數的引用
const mockPost = client.api.v1.email.send.$post as ReturnType<typeof vi.fn>;

describe("Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendEmail", () => {
    const mockEmailData = {
      email: "test@example.com",
      title: "測試標題",
      message: "這是一個測試訊息",
      captchaToken: "test-captcha-token",
    };

    it("應該成功發送電子郵件", async () => {
      const mockResponse = {
        success: true,
        message: "Email sent successfully",
      };

      mockPost.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await sendEmail(mockEmailData);

      expect(result).toEqual(mockResponse);
      expect(mockPost).toHaveBeenCalledWith(
        {
          json: {
            title: mockEmailData.title,
            message: mockEmailData.message,
            email: mockEmailData.email,
          },
        },
        {
          headers: {
            [X_CAPTCHA_RESPONSE]: mockEmailData.captchaToken,
          },
        }
      );
    });

    it("應該在 header 中包含 captcha token", async () => {
      mockPost.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await sendEmail(mockEmailData);

      expect(mockPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: {
            [X_CAPTCHA_RESPONSE]: "test-captcha-token",
          },
        })
      );
    });

    it("應該在請求失敗時拋出 HonoRPCError", async () => {
      mockPost.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          code: "VALIDATION_ERROR",
          errors: [{ message: "Invalid email format" }],
        }),
      });

      await expect(sendEmail(mockEmailData)).rejects.toThrow(HonoRPCError);
    });

    it("應該處理包含錯誤訊息的響應", async () => {
      const errorMessage = "Invalid email format";

      mockPost.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          code: "VALIDATION_ERROR",
          errors: [{ message: errorMessage }],
        }),
      });

      try {
        await sendEmail(mockEmailData);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(HonoRPCError);
        if (error instanceof HonoRPCError) {
          expect(error.message).toBe(errorMessage);
        }
      }
    });

    it("應該處理沒有錯誤詳情的失敗響應", async () => {
      mockPost.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => null,
      });

      await expect(sendEmail(mockEmailData)).rejects.toThrow("unknown error");
    });

    it("應該處理網路錯誤", async () => {
      mockPost.mockRejectedValue(new Error("Network error"));

      await expect(sendEmail(mockEmailData)).rejects.toThrow(HonoRPCError);
    });

    it("應該正確傳遞所有必要欄位", async () => {
      mockPost.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await sendEmail(mockEmailData);

      const callArgs = mockPost.mock.calls[0];
      expect(callArgs?.[0].json).toEqual({
        title: mockEmailData.title,
        message: mockEmailData.message,
        email: mockEmailData.email,
      });
    });
  });
});
