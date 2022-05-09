import type {GetStaticProps, NextPage} from 'next'
import { Head } from "../../components/globals/Layout/Head";
import { Footer } from "../../components/globals/Footer";
import { AboutMe } from "../../components/pages/home/AboutMe";
import { getImage } from "../../../firebase/images/services";
import { Layout } from "../../components/globals/Layout";

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
    return (
        <Layout
            title="Chia WEB"
            description="Yu Yu, Chia, 俞又嘉, WEB developer, UI/UX"
        >
            <main className="main">
                <div className="absolute top-0 left-0 z-10 overflow-visible rotate-12">
                    <h1 className="text-white/10 text-9xl bg-repeat">
                    </h1>
                </div>
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
