import type { NextPage } from 'next'
import { Header} from "../components/globals/Layout/Header";
import { Footer } from "../components/globals/Layout/Footer";

const EntryPage: NextPage = () => {
    return (
        <div className="c-container">
            <Header
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
