import { describe, it, expect } from "vitest";

import contact from "@/shared/contact";

describe("Contact Information", () => {
  it("應該定義聯絡資訊", () => {
    expect(contact).toBeDefined();
    expect(contact).toEqual(expect.any(Object));
  });

  it("每個聯絡方式應該有必要的屬性", () => {
    Object.entries(contact).forEach(([, item]) => {
      expect(item.name).toBeDefined();
      expect(item.name).toEqual(expect.any(String));

      expect(item.link).toBeDefined();
      expect(item.link).toEqual(expect.any(String));

      expect(item.icon).toBeDefined();
    });
  });

  it("聯絡連結應該是有效的 URL 或路徑", () => {
    Object.values(contact).forEach((item) => {
      expect(item.link).toMatch(/^(https?:\/\/|mailto:|\/)/);
    });
  });

  it("應該包含多個聯絡方式", () => {
    const contactCount = Object.keys(contact).length;
    expect(contactCount).toBeGreaterThan(0);
  });

  it("聯絡方式名稱不應為空", () => {
    Object.values(contact).forEach((item) => {
      expect(item.name.length).toBeGreaterThan(0);
    });
  });

  it("所有圖標應該被定義", () => {
    Object.values(contact).forEach((item) => {
      expect(item.icon).not.toBeNull();
      expect(item.icon).not.toBeUndefined();
    });
  });
});
