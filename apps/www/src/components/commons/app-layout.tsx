"use client";

import type { Locale } from "next-intl";

import ScrollYProgress from "@chia/ui/scroll-y-progess";

import { ChatDock } from "@/components/agent/chat-dock";
import Background from "@/components/commons/background";
import Footer from "@/components/commons/footer";
import NavMenu from "@/components/commons/nav-menu";

const AppLayout = ({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) => {
  return (
    <>
      <Background />
      {/* `--chat-dock-width` is 0 until the dock is open; only then does the page give up room. */}
      <div className="flex min-h-dvh flex-col pr-[var(--chat-dock-width,0px)] transition-[padding] duration-200 ease-out motion-reduce:transition-none">
        <NavMenu locale={locale} />
        <ScrollYProgress className="fixed top-0 z-999 w-[calc(100%-var(--chat-dock-width,0px))]" />
        <main data-testid="main-content" className="main container">
          {children}
        </main>
        <Footer locale={locale} />
      </div>
      <ChatDock />
    </>
  );
};

export default AppLayout;
