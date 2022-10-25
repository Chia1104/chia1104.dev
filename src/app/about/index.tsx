import type { NextPage } from "next";
import { Layout } from "@chia/components/shared";
import { Chia } from "@chia/shared/meta/chia";
import { Resume } from "@chia/components/pages/about";
import type { GetStaticProps } from "next";
import { getImage } from "@chia/firebase/client/files/services";
import { BASE_URL } from "@chia/shared/constants";

interface Props {
  url: string;
}

export const getStaticProps: GetStaticProps = async () => {
  const avatarUrl = await getImage("me/me.JPG");

  return {
    props: {
      url: avatarUrl as string,
    },
  };
};

const AboutPage: NextPage<Props> = (props) => {
  const name = Chia.name;
  const description = Chia.content;
  const chinese_name = Chia.chineseName;

  return (
    <Layout
      canonicalUrl={`${BASE_URL}/about`}
      title={`About | ${name} ${chinese_name} `}
      description={description}
      type="profile">
      <article className="main c-container mt-20">
        <Resume avatarSrc={props?.url || "/favicon.ico"} />
      </article>
    </Layout>
  );
};

export default AboutPage;
