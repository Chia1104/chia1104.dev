import { FC } from 'react';
import { PostFrontMatter } from '@chia/utils/types/post';
import { PostItem } from "./PostItem";
import Link from "next/link";
import { motion } from "framer-motion";

interface Props {
    post: PostFrontMatter[];
}

const postAnimation = {
    show: { transition: { staggerChildren: 0.1 } },
};

const postCardAnimation = {
    show: {
        y: [75, 0],
        opacity: [0, 1],
    },
}

export const PostsList: FC<Props> = ({ post }) => {
    return (
        <motion.div
            className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10"
            variants={postAnimation}
            animate={'show'}
        >
            {
                post.map((post: PostFrontMatter, index) => (
                    <Link
                        href={`/posts/${post.slug}`}
                        passHref
                        key={post.id}
                    >
                        <motion.a
                            variants={postCardAnimation}
                            // whileHover={{
                            //     scale: 1.03,
                            // }}
                            // whileTap={{ scale: 0.95 }}
                            className={index === 0 ? 'md:col-span-2 w-full' : 'w-full'}>
                            <PostItem data={post} i={index}/>
                        </motion.a>
                    </Link>
                ))
            }
        </motion.div>
    )
}
