import { getPinnedRepos } from "@chia/api/github";
import meta from "@chia/meta";

import { RepoCard } from "@/components/project/repo-card";

export const revalidate = 300;

const Page = async () => {
  const repo = await getPinnedRepos(meta.name);
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      {repo.user.pinnedItems.edges.map((item) => (
        <RepoCard
          key={item.node.id}
          href={item.node.url}
          image={item.node.openGraphImageUrl}
          name={item.node.name}
          description={item.node.description}
          language={item.node.primaryLanguage}
          updatedAt={item.node.pushedAt}
        />
      ))}
    </div>
  );
};

export default Page;
