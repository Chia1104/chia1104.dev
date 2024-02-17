import Gallery from "./_components/gallery";
import meta from "@chia/meta";
import { Age, FadeIn, Card, ErrorBoundary } from "@chia/ui";
import Location from "./_components/location";

const AboutPage = () => {
  return (
    <>
      <FadeIn className="w-full flex-col">
        <h1>About Me</h1>
        <p>
          Currently <Age birthday={meta.birthday} className="text-xl" /> years
          old
        </p>
        <Gallery />
        <p>
          Outside of programming, I enjoy traveling, playing video games with
          friends, and watching movies.
        </p>
      </FadeIn>
      <h2>Location</h2>
      <p className="flex items-center gap-2">
        <span className="i-mdi-location h-5 w-5" />
        Currently living in {meta.location}
      </p>
      <FadeIn className="flex w-full justify-center">
        <Card className="flex w-full justify-center">
          <ErrorBoundary>
            <Location
              cobeOptions={{
                opacity: 0.9,
              }}
              location={[24.91571, 121.6739]}
              className="size-[300px]"
              width={300}
              height={300}
            />
          </ErrorBoundary>
        </Card>
      </FadeIn>
    </>
  );
};

export default AboutPage;
