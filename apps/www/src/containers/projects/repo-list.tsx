import "server-only";
import { publicGitHubClient } from "@chia/integrations/github/client.public";
import { getPinnedRepos } from "@chia/integrations/github/profile";
import meta from "@chia/meta";

import {
  RULED_CELL_CLASS_NAME,
  RuledGridFiller,
} from "@/components/commons/ruled";
import { RepoCard } from "@/components/project/repo-card";

export const RepoList = async () => {
  const repo = await getPinnedRepos(publicGitHubClient, meta.name);
  const repos = repo.user.pinnedItems.edges;
  return (
    <ul className="rule-t rule-b page-md:grid-cols-2 grid">
      {repos.map((item) => (
        <li key={item.node.id} className={RULED_CELL_CLASS_NAME}>
          <RepoCard
            href={item.node.url}
            image={item.node.openGraphImageUrl}
            name={item.node.name}
            description={item.node.description ?? undefined}
            language={item.node.primaryLanguage ?? undefined}
            updatedAt={item.node.pushedAt}
          />
        </li>
      ))}
      <RuledGridFiller count={repos.length} />
    </ul>
  );
};
