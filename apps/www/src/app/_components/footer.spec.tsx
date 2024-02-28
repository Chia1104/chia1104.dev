import Footer from "./footer";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "test/utils";
import "@testing-library/jest-dom/vitest";
import { IntersectionObserverMock } from "vitest-shared";

vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

vi.mock("next/navigation", () => ({
  useSelectedLayoutSegments: vi.fn().mockReturnValue(["/"]),
}));

test("Footer renders correctly", () => {
  renderWithProviders(<Footer />);
  const footer = screen.getByTestId("footer");
  expect(footer).toBeInTheDocument();
});
