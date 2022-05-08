import type { NextPage } from 'next'
import { Head} from "../components/globals/Layout/Head";
import { Footer } from "../components/globals/Layout/Footer";

const EntryPage: NextPage = () => {
    return (
        <div className="c-container">
            <Head
                title="Chia WEB"
                description="Yu Yu, Chia, 俞又嘉, WEB developer, UI/UX"
            />

            <main className="main">
                <h1 className="title">
                    CHIA WEB
                </h1>
            </main>

            <Footer />
        </div>
    )
}

export default EntryPage
