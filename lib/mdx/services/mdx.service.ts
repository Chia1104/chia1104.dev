import path from 'path'
import fs from 'fs'
import matter from 'gray-matter'
import readingTime from 'reading-time'
import { sync } from 'glob'

const postsPath = path.join(process.cwd(), 'posts')

export async function getSlugs(): Promise<string[]> {
    const paths = sync('posts/*.mdx')

    return paths.map((path) => {
        const pathContent = path.split('/')
        const fileName = pathContent[pathContent.length - 1]
        const [slugs, _extension] = fileName.split('.')

        return slugs;
    })
}

export async function getPostFromSlug(slug: string) {
    const postDir = path.join(postsPath, `${slug}.mdx`)
    const source = fs.readFileSync(postDir)
    const { content, data } = matter(source)

    return {
        content,
        frontMatter: {
            slug,
            excerpt: data.excerpt,
            title: data.title,
            tags: data.tags,
            createdAt: data.createdAt,
            readingTime: readingTime(source.toString()).text,
            ...data,
        },
    }
}

export async function getAllPosts() {
    const posts = fs.readdirSync(path.join(process.cwd(), 'posts'))

    return posts.reduce((allPosts: any[], postSlug: string) => {
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
}

