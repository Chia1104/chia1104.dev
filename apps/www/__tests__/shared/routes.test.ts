import { describe, it, expect } from "vitest";

import navItems from "@/shared/routes";

describe("Navigation Routes", () => {
  it("應該定義所有導航項目", () => {
    expect(navItems).toBeDefined();
    expect(typeof navItems).toBe("object");
  });

  it("每個路由應該有 nameKey", () => {
    Object.entries(navItems).forEach(([, item]) => {
      expect(item.nameKey).toBeDefined();
      expect(typeof item.nameKey).toBe("string");
      expect(item.nameKey.length).toBeGreaterThan(0);
    });
  });

  it("路由路徑應該以 / 開頭", () => {
    Object.keys(navItems).forEach((path) => {
      expect(path).toMatch(/^\//);
    });
  });

  it("應該有多個導航項目", () => {
    const itemCount = Object.keys(navItems).length;
    expect(itemCount).toBeGreaterThan(0);
  });

  it("nameKey 應該是有效的翻譯鍵", () => {
    Object.values(navItems).forEach((item) => {
      expect(item.nameKey).toMatch(/^[a-z-]+$/);
    });
  });
});
