import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";
import { getPost } from "@chia/helpers/mdx/services";

const PostDetailHead = async ({ params }: { params: any }) => {
  const { frontMatter } = await fetch(`/api/posts/${params.slug}`).then((res) =>
    res.json()
  );
  return (
    <Head
      title={`${frontMatter?.title} | ${Chia.name} ${Chia.chineseName}`}
      description={`${frontMatter?.excerpt}`}
      keywords={frontMatter?.tags}
      type="article"
    />
  );
};

export default PostDetailHead;
