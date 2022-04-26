import type { NextPage } from 'next'
import { Header } from "../../components/globals/Header";
import { Footer } from "../../components/globals/Footer";
import { AboutMe } from "../../components/pages/home/AboutMe";

const HomePage: NextPage = () => {
    return (
        <div className="c-container">
            <Header
                title="Chia WEB"
                description="Yu Yu, Chia, 俞又嘉, WEB developer, UI/UX"
            />
            <main className="main">
                <AboutMe />
            </main>
            <Footer />
        </div>
    )
}

export default HomePage
