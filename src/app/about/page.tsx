import { Chia } from "@chia/shared/meta/chia";
import { Resume } from "@chia/components/pages/about";
import { Page } from "@chia/components/shared";

const AboutPage = () => {
  const name = Chia.name;
  const description = Chia.content;
  const chinese_name = Chia.chineseName;

  return (
    <Page>
      <article className="main c-container mt-20">
        <Resume avatarSrc={"/me/me.JPG"} />
      </article>
    </Page>
  );
};

export default AboutPage;
