import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { NavigationMenu } from "@chia/ui/navigation-menu";

import ListItem from "@/components/blog/list-item";

import { renderWithProviders } from "../../utils";

describe("ListItem Component", () => {
  it("應該渲染標題和內容", () => {
    renderWithProviders(
      <NavigationMenu>
        <ListItem href="/test" title="測試標題">
          測試內容描述
        </ListItem>
      </NavigationMenu>
    );

    expect(screen.getByText("測試標題")).toBeInTheDocument();
    expect(screen.getByText("測試內容描述")).toBeInTheDocument();
  });

  it("應該渲染為 Link 元素", () => {
    renderWithProviders(
      <NavigationMenu>
        <ListItem href="/test-link" title="測試標題">
          測試內容
        </ListItem>
      </NavigationMenu>
    );

    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test-link");
  });

  it("應該接受自定義 className", () => {
    const { container } = renderWithProviders(
      <NavigationMenu>
        <ListItem href="/test" title="測試標題" className="custom-class">
          測試內容
        </ListItem>
      </NavigationMenu>
    );

    const link = container.querySelector("a");
    expect(link).toHaveClass("custom-class");
  });

  it("應該處理沒有 children 的情況", () => {
    renderWithProviders(
      <NavigationMenu>
        <ListItem href="/test" title="只有標題" />
      </NavigationMenu>
    );

    expect(screen.getByText("只有標題")).toBeInTheDocument();
  });

  it("應該在列表項中渲染", () => {
    const { container } = renderWithProviders(
      <NavigationMenu>
        <ListItem href="/test" title="測試標題">
          測試內容
        </ListItem>
      </NavigationMenu>
    );

    const listItem = container.querySelector("li");
    expect(listItem).toBeInTheDocument();
  });

  it("應該包含正確的樣式類別", () => {
    const { container } = renderWithProviders(
      <NavigationMenu>
        <ListItem href="/test" title="測試標題">
          測試內容
        </ListItem>
      </NavigationMenu>
    );

    const link = container.querySelector("a");
    expect(link).toHaveClass("rounded-md");
    expect(link).toHaveClass("p-3");
  });
});
