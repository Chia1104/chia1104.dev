"use client";

import { captureException } from "@sentry/nextjs";
import { useTranslations } from "next-intl";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import Location from "@/components/about/location";
import {
  Panel,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/commons/ruled";

const COORDINATES: [number, number] = [24.91571, 121.6739];

export const LocationHero = () => {
  const t = useTranslations("about.location");
  const tProfile = useTranslations("profile");
  const [latitude, longitude] = COORDINATES;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t("title")}</PanelTitle>
        <PanelDescription>{t("description")}</PanelDescription>
      </PanelHeader>
      <figure>
        <div className="page-sm:h-[400px] relative flex h-[300px] flex-col items-center overflow-hidden px-2 pt-10">
          <ErrorBoundary onError={(error) => captureException(error)}>
            <span className="page-sm:text-6xl pointer-events-none bg-linear-to-b from-black to-gray-300/80 bg-clip-text text-center text-5xl leading-none font-semibold whitespace-pre-wrap text-transparent dark:from-white dark:to-slate-900/10">
              {tProfile("location")}
            </span>
            <div className="absolute top-24 left-1/2 aspect-square w-fit -translate-x-1/2">
              <Location
                cobeOptions={{
                  opacity: 0.9,
                }}
                className="page-sm:size-[600px] size-[400px]"
                location={COORDINATES}
                width={600}
                height={600}
              />
            </div>
          </ErrorBoundary>
        </div>
        <figcaption className="rule-t text-muted flex justify-end px-4 py-2 text-xs tabular-nums">
          {latitude}° N, {longitude}° E
        </figcaption>
      </figure>
    </Panel>
  );
};
