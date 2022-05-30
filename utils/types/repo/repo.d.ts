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
}
