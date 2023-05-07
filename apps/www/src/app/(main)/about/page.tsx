import { Resume } from "./components";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

const AboutPage = () => {
  return (
    <article className="main c-container mt-20">
      <Resume avatarSrc="/me/me.JPG" />
    </article>
  );
};

export default AboutPage;
