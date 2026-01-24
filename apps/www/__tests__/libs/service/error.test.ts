import { describe, it, expect } from "vitest";

import { HonoRPCError } from "@/libs/service/error";

describe("HonoRPCError", () => {
  it("應該創建一個包含所有屬性的錯誤", () => {
    const error = new HonoRPCError("TEST_ERROR", 400, "Test error message");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HonoRPCError);
    expect(error.code).toBe("TEST_ERROR");
    expect(error.status).toBe(400);
    expect(error.message).toBe("Test error message");
  });

  it("應該正確設置錯誤名稱", () => {
    const error = new HonoRPCError("TEST_ERROR", 500, "Server error");
    expect(error.name).toBe("HonoRPCError");
  });

  it("應該處理不同的 HTTP 狀態碼", () => {
    const testCases = [
      { status: 400, code: "BAD_REQUEST" },
      { status: 401, code: "UNAUTHORIZED" },
      { status: 403, code: "FORBIDDEN" },
      { status: 404, code: "NOT_FOUND" },
      { status: 500, code: "INTERNAL_ERROR" },
    ];

    testCases.forEach(({ status, code }) => {
      const error = new HonoRPCError(code, status, "Test message");
      expect(error.status).toBe(status);
      expect(error.code).toBe(code);
    });
  });

  it("應該能被 try-catch 捕獲", () => {
    expect(() => {
      throw new HonoRPCError("TEST_ERROR", 400, "Test error");
    }).toThrow(HonoRPCError);
  });

  it("應該能被 instanceof 檢查", () => {
    try {
      throw new HonoRPCError("TEST_ERROR", 400, "Test error");
    } catch (error) {
      expect(error instanceof HonoRPCError).toBe(true);
      expect(error instanceof Error).toBe(true);
    }
  });

  it("應該包含可讀的錯誤訊息", () => {
    const error = new HonoRPCError(
      "VALIDATION_ERROR",
      422,
      "Validation failed for field: email"
    );

    expect(error.toString()).toContain("HonoRPCError");
    expect(error.message).toBe("Validation failed for field: email");
  });

  it("應該處理空訊息", () => {
    const error = new HonoRPCError("ERROR_CODE", 500, "");
    expect(error.message).toBe("");
    expect(error.code).toBe("ERROR_CODE");
  });

  it("應該保持錯誤堆疊追蹤", () => {
    const error = new HonoRPCError("TEST_ERROR", 500, "Test error");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("HonoRPCError");
  });
});
