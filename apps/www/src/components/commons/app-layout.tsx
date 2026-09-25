"use client";

import Link from "next/link";

import type { Locale } from "next-intl";

import { AgentContextProvider } from "@chia/agent-elements/context";
import { SiteLinkProvider } from "@chia/agent-elements/markdown";
import ScrollYProgress from "@chia/ui/scroll-y-progess";

import { ChatDock } from "@/components/agent/chat-dock";
import Footer from "@/components/commons/footer";
import NavMenu from "@/components/commons/nav-menu";
import { PaletteStyle } from "@/components/commons/palette-style";

const AppLayout = ({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) => {
  return (
    // A page's selection menu files a prompt here; the chat dock's session sends it.
    <AgentContextProvider>
      {/* A link the agent gives into this site routes on the client like any other. */}
      <SiteLinkProvider value={Link}>
        <PaletteStyle />
        {/* `--dock-width` is unset until the dock is open; only then does the page give up room. */}
        <div className="@container/page isolate flex min-h-dvh flex-col pr-[var(--dock-width,0px)] transition-[padding] duration-200 ease-out motion-reduce:transition-none [html[data-dock-resizing]_&]:transition-none">
          <NavMenu locale={locale} />
          <ScrollYProgress className="bg-accent-gradient fixed top-0 z-999 w-[calc(100%-var(--dock-width,0px))]" />
          <main
            data-testid="main-content"
            className="flex flex-1 flex-col overflow-x-clip px-2">
            <div className="border-separator mx-auto flex w-full max-w-3xl flex-1 flex-col border-x py-12">
              {children}
            </div>
          </main>
          <Footer locale={locale} />
        </div>
        <ChatDock />
      </SiteLinkProvider>
    </AgentContextProvider>
  );
};

export default AppLayout;
