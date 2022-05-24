import dayjs from 'dayjs'
import React from 'react'
import Image from 'next/image'
import { MDXRemote, MDXRemoteProps } from 'next-mdx-remote'
import { getSlugs, getPost } from '@/lib/mdx/services'
import { Layout } from "@/components/globals/Layout";
import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import { PostFrontMatter } from "@/utils/types/post";
import { MDXComponents } from "@/components/pages/posts/MDXComponents";
import 'highlight.js/styles/atom-one-dark-reasonable.css'; // code syntax highlighting

import Giscus from "@giscus/react";
import type { GiscusProps } from "@giscus/react";
import { giscusConfig } from "@/utils/config/giscus.config";
import {useTheme} from "next-themes";

interface Props {
    source: MDXRemoteProps,
    frontMatter: PostFrontMatter,
}

export const getStaticPaths: GetStaticPaths = async () => {
    const slugs = await getSlugs()

    const paths = slugs.map((slug) => ({ params: { slug } }))

    return {
        paths,
        fallback: false,
    }
}

// @ts-ignore
export const getStaticProps: GetStaticProps = async ({ params }: { params: Pick<PostFrontMatter, "slug"> }) => {
    const { frontMatter, source } = await getPost(params.slug)

    return {
        props: {
            frontMatter,
            source,
        },
    }
}


const PostPage: NextPage<Props> = ({ source, frontMatter }) => {
    const { theme } = useTheme()

    return (
        <Layout
            title={frontMatter.title || 'Post'}
            description={frontMatter.excerpt || 'Post'}
        >
            <article className="main c-container mt-5 px-5">
                <div className="pl-3 lg:w-[80%] w-full self-start mb-10">
                    <h1 className="title">{frontMatter.title}</h1>
                    <h2 className="text-3xl">{frontMatter.excerpt}</h2>
                    <span className="description mt-5 flex items-center">
                        <Image
                            src="/memoji/contact-memoji.PNG"
                            width={40}
                            height={40}
                            className="rounded-full"
                            alt="Chia1104"
                        />
                        {dayjs(frontMatter.createdAt).format('MMMM D, YYYY')} &mdash;{' '}
                        {frontMatter.readingMins}
                    </span>
                </div>
                <div className="c-bg-secondary p-5 mt-5 rounded-xl lg:self-start lg:w-[80%] w-full self-center mx-auto lg:ml-2">
                    <MDXRemote
                        {...source}
                        // @ts-ignore
                        components={MDXComponents}
                    />
                </div>
                <div className="mt-20 lg:self-start lg:w-[80%] w-full self-center mx-auto lg:ml-2">
                    <Giscus
                        {...(giscusConfig as GiscusProps)}
                        term={frontMatter.title}
                        mapping="specific"
                        reactionsEnabled="1"
                        emitMetadata="0"
                        theme={theme === "dark" ? "dark_dimmed" : "light"}
                    />
                </div>
            </article>
        </Layout>
    )
}

export default PostPage
