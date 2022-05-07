export interface Post {
    id: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    published: boolean;

    map(element: (post: Post) => JSX.Element): any;
}
