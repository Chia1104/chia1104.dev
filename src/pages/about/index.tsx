import type { NextPage } from 'next'
import { Layout } from "@/components/globals/Layout";
import { Chia } from"@/utils/meta/chia"
import {Resume} from "@/components/pages/about/Resume";

const AboutPage: NextPage = () => {
    const description = Chia.content


    return (
        <Layout
            title="Chia1104 - About"
            description={description}
        >
            <div className="main c-container">
                <Resume avatarSrc={'/favicon.ico'} />
            </div>
        </Layout>
    )
}

export default AboutPage
