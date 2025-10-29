import meta from "@chia/meta";
import Age from "@chia/ui/age";
import FadeIn from "@chia/ui/fade-in";

import Gallery from "./gallery";

export function AboutMe() {
  return (
    <FadeIn className="w-full flex-col">
      <h1>About Me</h1>
      <p>
        Currently <Age birthday={meta.birthday} className="text-xl" /> years old
      </p>
      <Gallery />
      <p>
        Outside of programming, I enjoy traveling, playing video games with
        friends, and watching movies.
      </p>
    </FadeIn>
  );
}
