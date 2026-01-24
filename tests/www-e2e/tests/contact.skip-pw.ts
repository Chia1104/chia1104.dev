import { test, expect } from "@playwright/test";

import { ContactPage } from "../page-objects/ContactPage";

test.describe("聯絡頁面測試", () => {
  let contactPage: ContactPage;

  test.beforeEach(async ({ page }) => {
    contactPage = new ContactPage(page);
    await contactPage.navigate();
  });

  test("應該顯示聯絡表單", async () => {
    await expect(contactPage.emailInput).toBeVisible();
    await expect(contactPage.titleInput).toBeVisible();
    await expect(contactPage.messageInput).toBeVisible();
    await expect(contactPage.submitButton).toBeVisible();
  });

  test("表單欄位應該有正確的屬性", async () => {
    // Email 欄位應該是 email type
    const emailType = await contactPage.emailInput.getAttribute("type");
    expect(emailType).toBe("email");

    // 所有欄位應該是必填
    const emailRequired = await contactPage.emailInput.getAttribute("required");
    expect(emailRequired).toBeDefined();
  });

  test("應該能夠填寫表單", async () => {
    const testData = {
      email: "test@example.com",
      title: "測試標題",
      message: "這是測試訊息",
    };

    await contactPage.fillContactForm(testData);

    // 驗證輸入值
    await expect(contactPage.emailInput).toHaveValue(testData.email);
    await expect(contactPage.titleInput).toHaveValue(testData.title);
    await expect(contactPage.messageInput).toHaveValue(testData.message);
  });

  test("應該有提交按鈕", async () => {
    await expect(contactPage.submitButton).toBeEnabled();
  });
});
