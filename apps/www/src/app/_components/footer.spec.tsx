import Footer from "./footer";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IntersectionObserverMock } from "vitest-shared";

beforeAll(() => {
  // @ts-expect-error
  global.IntersectionObserver = IntersectionObserverMock;
});

afterAll(() => {
  // @ts-expect-error
  delete global.IntersectionObserver;
});

test("Footer renders correctly", () => {
  render(<Footer />);
  const footer = screen.getByTestId("footer");
  expect(footer).toBeInTheDocument();
});
