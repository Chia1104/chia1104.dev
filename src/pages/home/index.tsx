import type {GetStaticProps, NextPage} from 'next'
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
