import { FC } from 'react';
import { Post } from '@/utils/types/interfaces/post';
import { PostItem } from "./PostItem";
import Link from "next/link";

interface Props {
    post: Post;
}

export const PostsList: FC<Props> = ({ post }) => {
    return (
        <>
            {
                post.map((post: Post) => {
                    return (
                        <Link
                            href={`/posts/${post.slug}`}
                            passHref
                            key={post.id}
                        >
                            <a className="w-full m-3 hover:scale-[1.03]">
                                <PostItem data={post} />
                            </a>
                        </Link>
                    )
                })
            }
        </>
    )
}
