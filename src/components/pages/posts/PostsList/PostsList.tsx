import { FC } from 'react';
import { PostFrontMatter } from '@/utils/types/post';
import { PostItem } from "./PostItem";
import Link from "next/link";

interface Props {
    post: PostFrontMatter;
}

export const PostsList: FC<Props> = ({ post }) => {
    return (
        <>
            {
                // @ts-ignore
                post.map((post: PostFrontMatter) => {
                    return (
                        <Link
                            href={`/posts/${post.slug}`}
                            passHref
                            key={post.id}
                        >
                            <a className="w-full m-3 hover:scale-[1.03] transition ease-in-out">
                                <PostItem data={post} />
                            </a>
                        </Link>
                    )
                })
            }
        </>
    )
}
