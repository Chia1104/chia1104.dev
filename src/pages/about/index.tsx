import type { NextPage } from 'next'
import { Layout } from "@/components/globals/Layout";
import { Chia } from"@/utils/meta/chia"
import {Resume} from "@/components/pages/about/Resume";
import {GetStaticProps} from "next";
import {getImage} from "@/lib/firebase/files/services";

interface Props {
    url: string,
}

export const getStaticProps: GetStaticProps = async () => {
    const avatarUrl = await getImage('me/me.JPG');

    return {
        props: {
            url: avatarUrl as string,
        },
    }
}


const AboutPage: NextPage<Props> = ({url}) => {
    const description = Chia.content


    return (
        <Layout
            title="Chia1104 - About"
            description={description}
        >
            <article className="main c-container mt-20">
                <Resume avatarSrc={url || '/favicon.ico'} />
            </article>
        </Layout>
    )
}

export default AboutPage
