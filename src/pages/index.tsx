import type {GetStaticProps, NextPage} from 'next'
import { AboutMe } from "@/components/pages/home/AboutMe";
import { getImage } from "@/firebase/images/services";
import { Layout } from "@/components/globals/Layout";
import { Chia } from"@/utils/meta/chia"

interface Props {
    Url: string,
}

export const getStaticProps: GetStaticProps = async () => {
    const avatarUrl = await getImage('me-images/me-memoji.PNG');

    return {
        props: {
            Url: avatarUrl as string,
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
                        avatarSrc={props.Url}
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
