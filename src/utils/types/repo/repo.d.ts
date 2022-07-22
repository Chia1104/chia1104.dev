export type Repo = {
  id: number;
  name: string;
  owner: object;
  private: boolean;
  html_url: string;
  description: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  watchers_count: number;
  language: string;
  forks_count: number;
  topics: Array<string>;
};

export type RepoGql = {
  node: {
    id: number;
    name: string;
    url: string;
    description: string;
    pushedAt: string;
    stargazerCount: number;
    forkCount: number;
    primaryLanguage: {
      name: string;
      color: string;
    };
  };
};
