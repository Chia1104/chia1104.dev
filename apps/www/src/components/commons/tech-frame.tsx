import type { ReactNode } from "react";

import type { Locale } from "next-intl";

import ScrollYProgress from "@chia/ui/scroll-y-progess";

import Footer from "@/components/commons/footer";
import NavMenu from "@/components/commons/nav-menu";

/** The tech mode's frame: the ruled sheet with one railed reading column. */
const TechFrame = ({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) => (
  <>
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
  </>
);

export default TechFrame;
