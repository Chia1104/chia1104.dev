import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./footer";

describe("Footer", () => {
  test("renders", () => {
    render(<Footer />);
    expect(screen.findAllByText("Chia1104")).toBeTruthy();
  });
});
