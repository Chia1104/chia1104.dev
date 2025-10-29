import meta from "@chia/meta";
import Card from "@chia/ui/card";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import FadeIn from "@chia/ui/fade-in";

import Location from "@/components/about/location";

export const LocationHero = () => {
  return (
    <>
      <h2 className="flex items-center gap-3">
        Location <span className="i-mdi-location size-7" />
      </h2>
      <p>Here is where I am currently located.</p>
      <FadeIn className="flex w-full justify-center">
        <Card className="relative flex h-[300px] w-full justify-center p-2 pt-10 sm:h-[400px]">
          <ErrorBoundary>
            <span className="pointer-events-none whitespace-pre-wrap bg-linear-to-b from-black to-gray-300/80 bg-clip-text text-center text-5xl font-semibold leading-none text-transparent sm:text-6xl dark:from-white dark:to-slate-900/10">
              {meta.location}
            </span>
            <div
              className="absolute left-1/2 top-24 mx-auto aspect-square w-fit max-w-[600px]"
              style={{
                transform: "translate(-50%, 0)",
              }}>
              <Location
                cobeOptions={{
                  opacity: 0.9,
                }}
                className="size-[400px] sm:size-[600px]"
                location={[24.91571, 121.6739]}
                width={600}
                height={600}
              />
            </div>
          </ErrorBoundary>
        </Card>
      </FadeIn>
    </>
  );
};
