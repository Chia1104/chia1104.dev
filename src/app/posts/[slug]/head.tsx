import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";
// import { getPost } from "@chia/helpers/mdx/services";

const PostDetailHead = async ({ params }: { params: any }) => {
  // const { frontMatter } = await getPost(params.slug);
  return (
    <Head
      title={`${params?.slug} | ${Chia.name} ${Chia.chineseName}`}
      description={`${params?.slug}`}
      keywords={params?.slug}
      type="article"
    />
  );
};

export default PostDetailHead;
