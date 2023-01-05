import { Head } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";
import { getPost } from "@chia/helpers/mdx/services";
import { getBaseUrl } from "@chia/utils/getBaseUrl";

const PostDetailHead = async ({ params }: { params: any }) => {
  try {
    const { frontMatter } = await getPost(params.slug);
    return (
      <Head
        title={`${frontMatter.title} | ${Chia.name} ${Chia.chineseName}`}
        description={`${frontMatter.excerpt}`}
        type="article"
        imageUrl={`${getBaseUrl({ isServer: true })}/api/og?title=${
          frontMatter.title
        }`}
      />
    );
  } catch (error) {
    return <Head />;
  }
};

export default PostDetailHead;
