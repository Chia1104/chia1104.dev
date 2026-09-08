import { useState } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DOCK_WIDTH_VARIABLE, DockActions, DockShell } from "../src/dock";
import type { DockMode } from "../src/dock";

const STORAGE_KEY = "test.dock.width";

const Harness = ({ initialMode = "open" }: { initialMode?: DockMode }) => {
  const [mode, setMode] = useState<DockMode>(initialMode);
  return (
    <DockShell
      defaultWidth={400}
      label="Panel"
      mode={mode}
      onModeChange={setMode}
      resizeLabel="Resize"
      storageKey={STORAGE_KEY}>
      <DockActions
        labels={{ maximize: "Maximize", restore: "Restore", close: "Close" }}
        mode={mode}
        onModeChange={setMode}
      />
    </DockShell>
  );
};

const panel = () => screen.getByRole("complementary", { name: "Panel" });

describe("DockShell", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1600,
    });
  });

  it("gives the page the width while open and takes it back when closed", () => {
    render(<Harness />);
    expect(panel().dataset.mode).toBe("open");
    expect(
      document.documentElement.style.getPropertyValue(DOCK_WIDTH_VARIABLE)
    ).toContain("400px");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(panel().dataset.mode).toBe("closed");
    expect(
      document.documentElement.style.getPropertyValue(DOCK_WIDTH_VARIABLE)
    ).toBe("");
  });

  it("resizes from the keyboard and keeps the width as a preference", () => {
    render(<Harness />);
    const handle = screen.getByRole("separator", { name: "Resize" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle.getAttribute("aria-valuenow")).toBe("416");
    fireEvent.keyDown(handle, { key: "Home" });
    expect(handle.getAttribute("aria-valuenow")).toBe("320");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "")).toBe(320);

    fireEvent.doubleClick(handle);
    expect(handle.getAttribute("aria-valuenow")).toBe("400");
  });

  it("commits a drag once the pointer lifts", () => {
    render(<Harness />);
    const handle = screen.getByRole("separator", { name: "Resize" });
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 1200 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 1000 });
    expect(document.documentElement.hasAttribute("data-dock-resizing")).toBe(
      true
    );
    expect(handle.getAttribute("aria-valuenow")).toBe("400");

    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(document.documentElement.hasAttribute("data-dock-resizing")).toBe(
      false
    );
    expect(handle.getAttribute("aria-valuenow")).toBe("600");
  });

  it("maximizes over the page and comes back on Escape", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
    expect(panel().dataset.mode).toBe("maximized");
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(screen.queryByRole("separator")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel().dataset.mode).toBe("open");
    expect(document.documentElement.style.overflow).toBe("");
  });
});
