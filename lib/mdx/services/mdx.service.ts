import path from 'path'
import fs from 'fs'
import matter from 'gray-matter'
import readingTime from 'reading-time'
import { sync } from 'glob'

const postsPath = path.join(process.cwd(), 'posts')

export const getSlugs = async (): Promise<string[]> => {
    const paths = sync('posts/*.mdx')

    return paths.map((path) => {
        const pathContent = path.split('/')
        const fileName = pathContent[pathContent.length - 1]
        const [slugs, _extension] = fileName.split('.')

        return slugs;
    })
}

export const getPostFromSlug = async (slug: string) => {
    const postDir = path.join(postsPath, `${slug}.mdx`)
    const source = fs.readFileSync(postDir, 'utf8')
    const { content, data } = matter(source)

    return {
        content,
        frontMatter: {
            slug,
            excerpt: data.excerpt,
            title: data.title,
            tags: data.tags,
            createdAt: data.createdAt,
            readingTime: readingTime(source).text,
            ...data,
        },
    }
}

export const getAllPosts = async () => {
    const posts = fs.readdirSync(path.join(process.cwd(), 'posts'))

    const formatPosts = posts.reduce((allPosts: any[], postSlug: string) => {
        const source = fs.readFileSync(
            path.join(process.cwd(), 'posts', postSlug),
            'utf-8'
        )
        const { data } = matter(source)

        return [
            {
                ...data,
                slug: postSlug.replace('.mdx', ''),
                readingTime: readingTime(source).text,
            },
            ...allPosts,
        ]
    }, [])

    formatPosts
        .map((post) => post.data)
        .sort((a, b) => b.createdAt - a.createdAt)

    // console.debug(formatPosts)

    return formatPosts.reverse()
}

