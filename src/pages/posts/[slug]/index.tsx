import dayjs from 'dayjs'
import React from 'react'
import rehypeSlug from 'rehype-slug'
import { MDXRemote, MDXRemoteProps } from 'next-mdx-remote'
import rehypeHighlight from 'rehype-highlight'
import rehypeCodeTitles from 'rehype-code-titles'
import { serialize } from 'next-mdx-remote/serialize'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import { getSlugs, getPostFromSlug } from '@/lib/mdx/services'
import { Layout } from "@/components/globals/Layout";
import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import { Post } from "@/utils/types/interfaces/post";
import { MDXComponents } from "@/components/pages/posts/MDXComponents";
import 'highlight.js/styles/atom-one-dark-reasonable.css' // code syntax highlighting

interface Props {
    source: MDXRemoteProps,
    frontMatter: Post,
}

export const getStaticPaths: GetStaticPaths = async () => {
    const slugs = await getSlugs()

    const paths = slugs.map((slug) => ({ params: { slug } }))

    return {
        paths,
        fallback: false,
    }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {

    const slug = params?.slug
    // @ts-ignore
    const { content, frontMatter } = await getPostFromSlug(slug.toString())

    const mdxSource = await serialize(content, {
        mdxOptions: {
            rehypePlugins: [
                rehypeSlug,
                [
                    rehypeAutolinkHeadings,
                    {
                        properties: { className: ['anchor'] },
                    },
                    { behaviour: 'wrap' },
                ],
                rehypeHighlight,
                rehypeCodeTitles,
            ],
        },
    })

    return {
        props: {
            source: mdxSource,
            frontMatter,
        },
    }
}


const PostPage: NextPage<Props> = ({ source, frontMatter }) => {
    return (
        <Layout
            title={frontMatter.title}
            description={frontMatter.excerpt}
        >
            <div className="main c-container mt-5 px-5">
                <h1 className="title self-start">{frontMatter.title}</h1>
                <p className="description self-start">
                    {dayjs(frontMatter.createdAt).format('MMMM D, YYYY')} &mdash;{' '}
                    {frontMatter.readingTime}
                </p>
                <div className="c-bg-secondary p-5 mt-5 rounded-xl lg:self-start lg:w-[80%] content w-full self-center mx-auto lg:ml-2">
                    <MDXRemote {...source} components={MDXComponents} />
                </div>
            </div>
        </Layout>
    )
}

export default PostPage
