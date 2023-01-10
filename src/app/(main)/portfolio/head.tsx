import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";

const PortfolioHead = () => {
  return (
    <Head
      title={`Portfolio | ${Chia.name} ${Chia.chineseName} `}
      description={`${Chia.content} Welcome to my portfolio page. I always try to make the best of my time.`}
      type="profile"
      imageUrl={`/api/og?title=Portfolio`}
    />
  );
};

export default PortfolioHead;
