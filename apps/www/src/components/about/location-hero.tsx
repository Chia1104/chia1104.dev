"use client";

import { useTranslations } from "next-intl";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import Location from "@/components/about/location";
import { FeatureCard } from "@/components/commons/feature-card";

export const LocationHero = () => {
  const t = useTranslations("about.location");
  const tProfile = useTranslations("profile");
  return (
    <>
      <h2 className="flex items-center gap-3">
        {t("title")} <span className="i-mdi-location size-7" />
      </h2>
      <p>{t("description")}</p>
      <FeatureCard className="page-sm:h-[400px] relative flex h-[300px] w-full flex-col items-center justify-start p-2 pt-10">
        <ErrorBoundary>
          <span className="page-sm:text-6xl pointer-events-none bg-linear-to-b from-black to-gray-300/80 bg-clip-text text-center text-5xl leading-none font-semibold whitespace-pre-wrap text-transparent dark:from-white dark:to-slate-900/10">
            {tProfile("location")}
          </span>
          <div className="absolute top-24 left-1/2 mx-auto aspect-square w-fit max-w-[600px] translate-x-[-50%]">
            <Location
              cobeOptions={{
                opacity: 0.9,
              }}
              className="page-sm:size-[600px] size-[400px]"
              location={[24.91571, 121.6739]}
              width={600}
              height={600}
            />
          </div>
        </ErrorBoundary>
      </FeatureCard>
    </>
  );
};
