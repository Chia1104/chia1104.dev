import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";

const RootHead = () => {
  return (
    <Head
      title={`${Chia.name} ${Chia.chineseName} | ${Chia.title}`}
      description={Chia.content}
      imageUrl={`/api/og`}
    />
  );
};

export default RootHead;
