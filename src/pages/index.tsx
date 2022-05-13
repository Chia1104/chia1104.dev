import type {GetStaticProps, NextPage} from 'next'
import { AboutMe } from "@/components/pages/home/AboutMe";
import { getImage } from "@/firebase/images/services";
import { Layout } from "@/components/globals/Layout";
import { Chia } from"@/utils/meta/chia"
import { PostFrontMatter } from "@/utils/types/post";
import { getAllPosts } from "@/lib/mdx/services";

interface Props {
    url: string,
    post: PostFrontMatter,
}

export const getStaticProps: GetStaticProps = async () => {
    const avatarUrl = await getImage('me-images/me-memoji.PNG');
    const posts = await getAllPosts()

    return {
        props: {
            url: avatarUrl as string,
            post: posts[0],
        },
    }
}


const HomePage: NextPage<Props> = (props) => {
    const name = Chia.name;
    const title = Chia.title;
    const description = Chia.content

    return (
        <Layout
            title={`${name} - ${title}`}
            description={description}
        >
            <main className="main">
                <div className="c-container">
                    <AboutMe
                        newTitle={props.post.title || 'New update'}
                        newUpdate={props.post.excerpt || 'This is an example of a blog post.'}
                        slug={props.post.slug}
                        avatarSrc={props.url}
                    />
                </div>
            </main>
            <article>
                <div className="c-container">
                </div>
            </article>
        </Layout>
    )
}

export default HomePage
