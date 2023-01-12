import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";

const PostHead = () => {
  return (
    <Head
      title={`Blog | ${Chia.name} ${Chia.chineseName} `}
      description={`${Chia.content} Welcome to my blog. I always try to make the best of my time.`}
      type="article"
      imageUrl={`/api/og?title=${encodeURIComponent("Blog")}`}
    />
  );
};

export default PostHead;
