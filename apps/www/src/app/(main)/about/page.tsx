import Gallery from "./gallery";
import { Chia } from "@/shared/meta/chia";
import { Age } from "@chia/ui";

const AboutPage = () => {
  return (
    <>
      <h1>About Me</h1>
      <p>
        Currently <Age birthday={Chia.birthday} className="text-xl" /> years old
      </p>
      <Gallery />
      <p>
        Outside of programming, I enjoy traveling, playing video games with
        friends, and watching movies.
      </p>
    </>
  );
};

export default AboutPage;
