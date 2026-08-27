import type { ReactNode } from "react";

import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import type { RouterOutputs } from "@/libs/orpc/types";

/**
 * The cards are react-hook-form forms over the admin contract. Pinned here: a card starts
 * clean with Save disabled, an edit makes it dirty, and submit writes exactly the override
 * the edit means — a prompt equal to the default is `null`, a parameter equal to the default
 * is dropped, an emptied config field is absent.
 */

const { client } = vi.hoisted(() => ({
  client: {
    agent: {
      models: { list: vi.fn() },
      capabilities: { list: vi.fn() },
      admin: {
        kinds: { list: vi.fn(), update: vi.fn() },
        tasks: { list: vi.fn(), update: vi.fn(), models: vi.fn() },
      },
    },
  },
}));

vi.mock("@/libs/orpc/client", () => ({
  client,
  orpc: createTanstackQueryUtils(client),
}));

type TaskAdmin = RouterOutputs["agent"]["admin"]["tasks"]["list"][number];
type KindAdmin = RouterOutputs["agent"]["admin"]["kinds"]["list"][number];

const HOUSE = {
  providerId: "vercel-ai-gateway",
  modelId: "anthropic/claude-haiku-4.5",
};

const task: TaskAdmin = {
  id: "session.title",
  label: "Session title",
  description: "Names a session.",
  kind: null,
  model: { default: HOUSE, override: null, effective: HOUSE },
  prompt: { default: "You name chat sessions.", override: null },
  params: {
    default: { maxTokens: 64, temperature: 0.2 },
    override: {},
    effective: { maxTokens: 64, temperature: 0.2 },
  },
  updatedAt: null,
};

const kind: KindAdmin = {
  kind: "writing",
  label: "Writing",
  description: "Drafts posts.",
  minTier: 3,
  defaults: {
    code: {
      providerId: "vercel-ai-gateway",
      modelId: "anthropic/claude-sonnet-5",
      thinkingLevel: "off",
      autoApprove: [],
    },
    override: { model: null, thinkingLevel: null, autoApprove: null },
    effective: {
      providerId: "vercel-ai-gateway",
      modelId: "anthropic/claude-sonnet-5",
      thinkingLevel: "off",
      autoApprove: [],
    },
  },
  config: {
    schema: {
      type: "object",
      properties: { instructions: { type: "string", maxLength: 8000 } },
    },
    defaults: {},
    override: {},
    effective: {},
  },
  updatedAt: null,
};

const Providers = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const saveButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
const isDisabled = (element: HTMLElement) =>
  element.hasAttribute("disabled") ||
  element.getAttribute("aria-disabled") === "true";

describe("TaskCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.agent.admin.tasks.update.mockImplementation(async (input) => ({
      ...task,
      prompt: { ...task.prompt!, override: input.systemPrompt ?? null },
      updatedAt: 1,
    }));
  });

  it("starts clean and writes only what differs from the code", async () => {
    const { TaskCard } = await import("../src/components/agents/task-card");
    render(<TaskCard models={[]} task={task} />, { wrapper: Providers });

    expect(isDisabled(saveButton())).toBe(true);

    const prompt = screen.getByRole<HTMLTextAreaElement>("textbox", {
      name: "Session title system prompt",
    });
    fireEvent.change(prompt, { target: { value: "Name it tersely." } });
    await waitFor(() => expect(isDisabled(saveButton())).toBe(false));

    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(client.agent.admin.tasks.update).toHaveBeenCalledWith(
        {
          id: "session.title",
          model: null,
          systemPrompt: "Name it tersely.",
          // both parameters still equal the default, so neither is written
          params: {},
        },
        expect.anything()
      )
    );
    // the saved row becomes the new baseline
    await waitFor(() => expect(isDisabled(saveButton())).toBe(true));
  });

  it("writes null for a prompt typed back to the default", async () => {
    const { TaskCard } = await import("../src/components/agents/task-card");
    render(
      <TaskCard
        models={[]}
        task={{ ...task, prompt: { ...task.prompt!, override: "Custom." } }}
      />,
      { wrapper: Providers }
    );
    const prompt = screen.getByRole<HTMLTextAreaElement>("textbox", {
      name: "Session title system prompt",
    });
    expect(prompt.value).toBe("Custom.");

    fireEvent.click(screen.getByRole("button", { name: "Restore default" }));
    await waitFor(() => expect(prompt.value).toBe(task.prompt!.default));
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(client.agent.admin.tasks.update).toHaveBeenCalledWith(
        expect.objectContaining({ systemPrompt: null }),
        expect.anything()
      )
    );
  });
});

describe("KindCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.agent.models.list.mockResolvedValue([]);
    client.agent.capabilities.list.mockResolvedValue({
      tools: [
        { name: "get_post", label: "Read", tier: "read", description: "" },
        {
          name: "commit_draft",
          label: "Commit",
          tier: "commit",
          description: "",
        },
      ],
      commands: [],
      skills: [],
    });
    client.agent.admin.kinds.update.mockImplementation(async (input) => ({
      ...kind,
      config: { ...kind.config, override: input.config ?? {} },
      updatedAt: 1,
    }));
  });

  it("writes the config override with emptied fields dropped", async () => {
    const { KindCard } = await import("../src/components/agents/kind-card");
    render(<KindCard kind={kind} />, { wrapper: Providers });

    expect(isDisabled(saveButton())).toBe(true);
    const instructions = screen.getByRole("textbox", { name: "Instructions" });
    fireEvent.change(instructions, { target: { value: "Short intros." } });
    await waitFor(() => expect(isDisabled(saveButton())).toBe(false));

    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(client.agent.admin.kinds.update).toHaveBeenCalledWith(
        {
          kind: "writing",
          model: null,
          thinkingLevel: null,
          autoApprove: null,
          config: { instructions: "Short intros." },
        },
        expect.anything()
      )
    );

    // clearing the field means "code default", not an empty instruction
    await waitFor(() => expect(isDisabled(saveButton())).toBe(true));
    fireEvent.change(instructions, { target: { value: "" } });
    await waitFor(() => expect(isDisabled(saveButton())).toBe(false));
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(client.agent.admin.kinds.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ config: {} }),
        expect.anything()
      )
    );
  });

  it("turns the pre-approval override on as an empty list and off as null", async () => {
    const { KindCard } = await import("../src/components/agents/kind-card");
    render(<KindCard kind={kind} />, { wrapper: Providers });

    const toggle = await screen.findByRole("switch", {
      name: /Override pre-approved tool tiers/,
    });
    await waitFor(() => expect(isDisabled(toggle)).toBe(false));
    fireEvent.click(toggle);
    await waitFor(() => expect(isDisabled(saveButton())).toBe(false));
    fireEvent.click(await screen.findByRole("checkbox", { name: "commit" }));
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(client.agent.admin.kinds.update).toHaveBeenCalledWith(
        expect.objectContaining({ autoApprove: ["commit"] }),
        expect.anything()
      )
    );
  });
});
