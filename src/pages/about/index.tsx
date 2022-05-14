import type { NextPage } from 'next'
import { Layout } from "@/components/globals/Layout";
import { Chia } from"@/utils/meta/chia"
import {Resume} from "@/components/pages/about/Resume";
import {GetStaticProps} from "next";
import {getImage} from "@/firebase/images/services";

interface Props {
    url: string,
}

export const getStaticProps: GetStaticProps = async () => {
    const avatarUrl = await getImage('me-images/me.JPG');

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
            <div className="main c-container mt-20">
                <Resume avatarSrc={url || '/favicon.ico'} />
            </div>
        </Layout>
    )
}

export default AboutPage
