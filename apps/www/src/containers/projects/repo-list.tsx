import "server-only";
import { publicGitHubClient } from "@chia/integrations/github/client.public";
import { getPinnedRepos } from "@chia/integrations/github/profile";
import meta from "@chia/meta";

import { RepoCard } from "@/components/project/repo-card";

export const RepoList = async () => {
  const repo = await getPinnedRepos(publicGitHubClient, meta.name);
  return (
    <div className="page-md:grid-cols-2 mt-4 grid grid-cols-1 gap-4">
      {repo.user.pinnedItems.edges.map((item) => (
        <RepoCard
          key={item.node.id}
          href={item.node.url}
          image={item.node.openGraphImageUrl}
          name={item.node.name}
          description={item.node.description ?? undefined}
          language={item.node.primaryLanguage ?? undefined}
          updatedAt={item.node.pushedAt}
        />
      ))}
    </div>
  );
};
