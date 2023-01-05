import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";
import { getBaseUrl } from "@chia/utils/getBaseUrl";

const PostHead = () => {
  return (
    <Head
      title={`Blog | ${Chia.name} ${Chia.chineseName} `}
      description={`${Chia.content} Welcome to my blog. I always try to make the best of my time.`}
      type="article"
      imageUrl={`${getBaseUrl({ isServer: true })}/api/og?title=Blog`}
    />
  );
};

export default PostHead;
