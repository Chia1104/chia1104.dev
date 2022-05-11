export interface Post {
    slug: string;
    id: number;
    title: string;
    excerpt: string;
    tags: string[];
    createdAt: string;
    updateAt: string;
    readingTime: string;
    published: boolean;

    map(element: (post: Post) => JSX.Element): any;
}
