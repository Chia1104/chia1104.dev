import { Resume } from "@chia/components/server";

const AboutPage = () => {
  return (
    <article className="main c-container mt-20">
      <Resume avatarSrc={"/me/me.JPG"} />
    </article>
  );
};

export const dynamic = "force-static";

export default AboutPage;
