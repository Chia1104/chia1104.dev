import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComposerContext } from "@chia/agent-elements/composer";
import {
  AgentContextProvider,
  useProvideAgentContext,
} from "@chia/agent-elements/context";

const Page = ({ title }: { title: string }) => {
  useProvideAgentContext({ type: "draft", id: 7, label: title });
  return null;
};

describe("agent context", () => {
  it("lists what the page provides and lets the operator detach and re-attach it", () => {
    const { rerender } = render(
      <AgentContextProvider>
        <Page title="Untitled" />
        <ComposerContext />
      </AgentContextProvider>
    );
    expect(screen.getByText("Untitled")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByText("Not attached: Untitled")).toBeDefined();

    // A retitled draft is the same record: the operator's decision stands.
    rerender(
      <AgentContextProvider>
        <Page title="Now titled" />
        <ComposerContext />
      </AgentContextProvider>
    );
    expect(screen.getByText("Not attached: Now titled")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Attach" }));
    expect(screen.getByText("Now titled")).toBeDefined();

    rerender(
      <AgentContextProvider>
        <ComposerContext />
      </AgentContextProvider>
    );
    expect(screen.queryByText("Now titled")).toBeNull();
  });
});
