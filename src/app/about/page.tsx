import { Resume } from "@chia/components/server";
import { Page } from "@chia/components/client";

const AboutPage = () => {
  return (
    <Page>
      <article className="main c-container mt-20">
        <Resume avatarSrc={"/me/me.JPG"} />
      </article>
    </Page>
  );
};

export const dynamic = "error";

export default AboutPage;
