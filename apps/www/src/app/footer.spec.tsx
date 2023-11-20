import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./footer";
import { renderWithProviders } from "test/test-setup";

describe("Footer", () => {
  test("renders", () => {
    const { findAllByText } = renderWithProviders(<Footer />);
    expect(findAllByText("Chia1104")).toBeTruthy();
  });
});
