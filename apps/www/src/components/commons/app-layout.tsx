import type { Locale } from "next-intl";

import ScrollYProgress from "@chia/ui/scroll-y-progess";

import Background from "@/components/commons/background";
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
      <NavMenu locale={locale} />
      <ScrollYProgress className="fixed top-0 z-[999]" />
      <main data-testid="main-content" className="main container">
        {children}
      </main>
    </>
  );
};

export default AppLayout;
