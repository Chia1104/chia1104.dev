import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";
import { getBaseUrl } from "@chia/utils/getBaseUrl";

const AboutHead = () => {
  return (
    <Head
      title={`About | ${Chia.name} ${Chia.chineseName} `}
      description={Chia.content}
      type="profile"
      imageUrl={`${getBaseUrl({ isServer: true })}/api/og?title=About Me`}
    />
  );
};

export default AboutHead;
