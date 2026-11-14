"use client";

import Link from "next/link";

import { AgentContextProvider } from "@chia/agent-elements/context";
import { SiteLinkProvider } from "@chia/agent-elements/markdown";

import { ChatDock } from "@/components/agent/chat-dock";
import { ModeTransitionProvider } from "@/components/commons/mode-transition";
import { PaletteStyle } from "@/components/commons/palette-style";

/**
 * What every mode shares: the page container, the chat dock and the curtain a switch between
 * modes happens behind. Each mode's frame renders inside, so the dock's session survives a switch.
 */
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    // A page's selection menu files a prompt here; the chat dock's session sends it.
    <AgentContextProvider>
      {/* A link the agent gives into this site routes on the client like any other. */}
      <SiteLinkProvider value={Link}>
        <PaletteStyle />
        <ModeTransitionProvider>
          {/* `--dock-width` is unset until the dock is open; only then does the page give up room. */}
          <div className="@container/page isolate flex min-h-dvh flex-col pr-[var(--dock-width,0px)] transition-[padding] duration-200 ease-out motion-reduce:transition-none [html[data-dock-resizing]_&]:transition-none">
            {children}
          </div>
          <ChatDock />
        </ModeTransitionProvider>
      </SiteLinkProvider>
    </AgentContextProvider>
  );
};

export default AppLayout;
