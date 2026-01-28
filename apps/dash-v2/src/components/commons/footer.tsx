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
    <footer className={cn("c-bg-third flex w-full flex-col", className)}>
      <div className="mx-auto w-full px-6 py-5 md:flex md:items-center md:justify-between lg:px-8">
        <div className="flex flex-col items-center justify-center gap-2 md:order-2 md:items-end">
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
        <div className="mt-4 flex flex-col gap-2 md:order-1 md:mt-0">
          <div className="flex items-center justify-center gap-3 md:justify-start">
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
          <p className="text-default-400 text-center text-xs md:text-start">
            &copy; {dayjs().format("YYYY")} Chia1104.dev. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
