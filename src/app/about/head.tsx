import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";

const AboutHead = () => {
  return (
    <Head
      title={`About | ${Chia.name} ${Chia.chineseName} `}
      description={Chia.content}
      type="profile"
    />
  );
};

export default AboutHead;
