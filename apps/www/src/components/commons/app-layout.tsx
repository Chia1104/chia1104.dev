import ScrollYProgress from "@chia/ui/scroll-y-progess";

import Background from "@/components/commons/background";
import NavMenu from "@/components/commons/nav-menu";
import type { I18N } from "@/utils/i18n";

const AppLayout = ({
  locale,
  children,
}: {
  locale: I18N;
  children: React.ReactNode;
}) => {
  return (
    <>
      <Background />
      <NavMenu locale={locale} />
      <ScrollYProgress className="fixed top-0 z-[999]" />
      <main>{children}</main>
    </>
  );
};

export default AppLayout;
