import type { NextPage } from "next";
import { Layout } from "@chia/components/globals/Layout";
import { Chia } from "@chia/utils/meta/chia";
import { Resume } from "@chia/components/pages/about/Resume";
import type { GetStaticProps } from "next";
import { getImage } from "@chia/lib/firebase/client/files/services";

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

const AboutPage: NextPage<Props> = ({ url }) => {
  const name = Chia.name;
  const description = Chia.content;
  const chinese_name = Chia.chineseName;

  return (
    <Layout
      title={`About | ${name} ${chinese_name} `}
      description={description}
    >
      <article className="main c-container mt-20">
        <Resume avatarSrc={url || "/favicon.ico"} />
      </article>
    </Layout>
  );
};

export default AboutPage;
