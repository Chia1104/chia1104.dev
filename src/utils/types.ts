export interface Post {
    slug: string;
    id: number;
    title: string;
    excerpt: string;
    createdAt: string;
    readingTime: string;
    published: boolean;

    map(element: (post: Post) => JSX.Element): any;
}
