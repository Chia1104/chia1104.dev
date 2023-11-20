import Gallery from "./gallery";
import meta from "@chia/meta";
import { Age, FadeIn } from "@chia/ui";

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
    </>
  );
};

export default AboutPage;
