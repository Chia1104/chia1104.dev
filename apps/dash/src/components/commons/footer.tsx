import type { ReactNode } from "react";
import { Suspense } from "react";

import { Divider } from "@heroui/react";

import { ErrorBoundary } from "@chia/ui/error-boundary";
import dayjs from "@chia/utils/day";

import { AcmeIcon } from "./acme";
import { ServiceStatus } from "./service-status.rsc";
import { LoadingFallback, ErrorFallback } from "./status-chip";

const Footer = ({
  inject,
}: {
  inject: {
    themeSwitch: ReactNode;
  };
}) => {
  return (
    <footer className="flex w-full flex-col c-bg-third">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
        <div className="flex flex-col items-center justify-center gap-2 md:order-2 md:items-end">
          {inject.themeSwitch}
        </div>
        <div className="mt-4 md:order-1 md:mt-0">
          <div className="flex items-center justify-center gap-3 md:justify-start">
            <div className="flex items-center">
              <AcmeIcon size={34} />
              <span className="text-small font-medium">Chia1104.dev</span>
            </div>
            <Divider className="h-4" orientation="vertical" />
            <ErrorBoundary errorElement={<ErrorFallback />}>
              <Suspense fallback={<LoadingFallback />}>
                <ServiceStatus />
              </Suspense>
            </ErrorBoundary>
          </div>
          <p className="text-center text-tiny text-default-400 md:text-start">
            &copy; {dayjs().format("YYYY")} Chia1104.dev. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
