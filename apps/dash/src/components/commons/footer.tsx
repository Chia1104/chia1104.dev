import { Suspense } from "react";

import { ErrorBoundary } from "@chia/ui/error-boundary";
import ThemeSwitch from "@chia/ui/theme";
import { cn } from "@chia/ui/utils/cn.util";
import dayjs from "@chia/utils/day";

import { Logo } from "./logo";
import { ServiceStatus } from "./service-status.rsc";
import { LoadingFallback, ErrorFallback } from "./status-chip";

const Footer = ({ className }: { className?: string }) => {
  return (
    <footer
      className={cn(
        "bg-sidebar border-sidebar-border flex w-full flex-col border-t",
        className
      )}>
      <div className="page-md:flex page-md:items-center page-md:justify-between page-lg:px-8 mx-auto w-full px-6 py-5">
        <div className="page-md:order-2 page-md:items-end flex flex-col items-center justify-center gap-2">
          <ThemeSwitch
            dropdownProps={{
              popover: {
                placement: "top",
              },
            }}
            buttonProps={{
              variant: "tertiary",
            }}
          />
        </div>
        <div className="page-md:order-1 page-md:mt-0 mt-4 flex flex-col gap-2">
          <div className="page-md:justify-start flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="text-small font-medium">Chia1104.dev</span>
            </div>
            <ErrorBoundary errorElement={<ErrorFallback />}>
              <Suspense fallback={<LoadingFallback />}>
                <ServiceStatus />
              </Suspense>
            </ErrorBoundary>
          </div>
          <p className="text-muted page-md:text-start text-center text-xs">
            &copy; {dayjs().format("YYYY")} Chia1104.dev. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
