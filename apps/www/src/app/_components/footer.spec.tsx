import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "test/utils";
import { IntersectionObserverMock } from "vitest-shared";

import Footer from "./footer";

vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

vi.mock("next/navigation", () => ({
  useSelectedLayoutSegments: vi.fn().mockReturnValue(["/"]),
}));

test("Footer renders correctly", () => {
  renderWithProviders(<Footer />);
  const footer = screen.getByTestId("footer");
  expect(footer).toBeInTheDocument();
});
