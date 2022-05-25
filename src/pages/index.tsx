import type {GetStaticProps, NextPage} from 'next'
import { AboutMe } from "@/components/pages/home/AboutMe";
import { getImage } from "@/firebase/images/services";
import { Layout } from "@/components/globals/Layout";
import { Chia } from"@/utils/meta/chia"
import { PostFrontMatter } from "@/utils/types/post";
import { getAllPosts } from "@/lib/mdx/services";
import {NewsCard} from "@/components/pages/home/NewsCard";
import dayjs from "dayjs";

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

    const postSubtitle = dayjs(props.post.createdAt).format('MMMM D, YYYY');

    return (
        <Layout
            title={`${name} - ${title}`}
            description={description}
        >
            <article className="c-container main">
                <div className="w-full h-full flex flex-col">
                    <AboutMe
                        avatarSrc={props.url}
                    />
                    <div className="flex flex-col justify-center items-center md:flex-row mx-auto mt-10 w-full min:w-[370px] max-w-[740px] w-full">
                        <div className="py-7 px-3">
                            <NewsCard
                                title={'About me'}
                                content={description}
                                subtitle={''}
                                link={'/about'}
                            />
                        </div>
                        <div className="py-7 px-3">
                            <NewsCard
                                title={'New update'}
                                content={props.post.excerpt || 'This is an example of a blog post.'}
                                subtitle={postSubtitle}
                                link={`posts/${props.post.slug}`}
                            />
                        </div>
                    </div>
                    <div className="bg-primary/90 rounded-xl p-5 mt-10 mx-auto text-white backdrop-blur-sm min:w-[370px] max-w-[740px] w-full">
                        <ul>
                            <li className="mb-2">
                                🔭 I’m currently working on: My personal website with NextJS
                            </li>
                            <li className="mb-2">
                                🌱 I’m currently learning: Docker, Next.js, Nest.js, TypeScript, Go
                            </li>
                            <li className="mb-2">
                                👯 I’m looking to collaborate on: Intern
                            </li>
                            <li className="mb-2">
                                📫 How to reach me: yuyuchia7423@gmail.com
                            </li>
                            <li>
                                ⚡ Fun fact:
                                <a href="https://open.spotify.com/user/21vnijzple4ufn2nzlfjy37py?si=b5f011d11a794ba4&nd=1" target="_blank" rel="noreferrer" className="link link-underline link-underline-black text-info"> Spotify </a>
                                /
                                {/* eslint-disable-next-line react/no-unescaped-entities */}
                                <a href="https://skyline.github.com/Chia1104/2022" target="_blank" rel="noreferrer" className="link link-underline link-underline-black text-info"> Chia1104's 2022 GitHub Skyline </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </article>
        </Layout>
    )
}

export default HomePage
