import Footer from "./footer";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IntersectionObserverMock } from "vitest-shared";

vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

test("Footer renders correctly", () => {
  render(<Footer />);
  const footer = screen.getByTestId("footer");
  expect(footer).toBeInTheDocument();
});
