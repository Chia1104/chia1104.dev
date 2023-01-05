import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";
import { getBaseUrl } from "@chia/utils/getBaseUrl";

const RootHead = () => {
  return (
    <Head
      title={`${Chia.name} ${Chia.chineseName} | ${Chia.title}`}
      description={Chia.content}
      imageUrl={`${getBaseUrl({ isServer: true })}/api/og`}
    />
  );
};

export default RootHead;
