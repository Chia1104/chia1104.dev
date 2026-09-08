import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/agent/agent-panel", () => ({
  AgentPanel: () => <div data-testid="agent-panel" />,
}));

const { AgentDock, AgentDockTrigger } =
  await import("../src/components/agent/agent-dock");

describe("AgentDock", () => {
  it("opens from the trigger and survives the page around it remounting", async () => {
    const page = render(
      <>
        <AgentDockTrigger />
        <AgentDock />
      </>
    );

    expect(screen.queryByTestId("agent-panel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Writing agent" }));
    expect(await screen.findByTestId("agent-panel")).toBeDefined();

    // What a navigation does to the dock: the tree unmounts, the open state does not.
    page.unmount();
    render(<AgentDock />);
    expect(await screen.findByTestId("agent-panel")).toBeDefined();
  });
});
