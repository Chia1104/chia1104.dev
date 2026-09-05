import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/agent/agent-panel", () => ({
  AgentPanel: () => <div data-testid="agent-panel" />,
}));

const { AgentDrawer, AgentDrawerTrigger } =
  await import("../src/components/agent/agent-drawer");

describe("AgentDrawer", () => {
  it("stays closed until `?agent` is set, and the trigger sets it", async () => {
    const onUrlUpdate = vi.fn();
    render(
      <>
        <AgentDrawerTrigger />
        <AgentDrawer />
      </>,
      { wrapper: withNuqsTestingAdapter({ searchParams: "", onUrlUpdate }) }
    );

    expect(screen.queryByTestId("agent-panel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Writing agent" }));
    // nuqs batches URL writes; the update lands on the next tick.
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("agent")).toBe(
      "open"
    );
  });

  it("mounts the panel when the page opened with `?agent`", () => {
    render(<AgentDrawer />, {
      wrapper: withNuqsTestingAdapter({ searchParams: "?agent=open" }),
    });
    expect(screen.getByTestId("agent-panel")).toBeDefined();
  });
});
