import type { NextPage } from 'next'
import { Layout } from "@/components/globals/Layout";
import { Chia } from"@/utils/meta/chia"

const AboutPage: NextPage = () => {
    const description = Chia.content


    return (
        <Layout
            title="Chia1104 - About"
            description={description}
        >
            <div className="main c-container">
                <h1 className="title">
                    About Page
                </h1>
            </div>
        </Layout>
    )
}

export default AboutPage
