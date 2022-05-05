import type { NextPage } from 'next'
import { Header } from "../../components/globals/Layout/Header";
import { Footer } from "../../components/globals/Layout/Footer";
import { AboutMe } from "../../components/pages/home/AboutMe";
import { SocialIcon } from "../../components/pages/home/SocialIcon";
import { ChiaTimeLine } from "../../components/pages/home/ChiaTimeLine";

const HomePage: NextPage = () => {
    return (
        <>
            <Header
                title="Chia WEB"
                description="Yu Yu, Chia, 俞又嘉, WEB developer, UI/UX"
            />
            <main className="main bg-primary/90">
                <div className="absolute top-0 left-0 z-10 overflow-visible rotate-12">
                    <h1 className="text-white/10 text-9xl"></h1>
                </div>
                <div className="c-container">
                    <AboutMe />
                    <SocialIcon />
                </div>
            </main>
            <article>
                <div className="c-container">
                    <ChiaTimeLine />
                </div>
            </article>
            <div className="c-container">
                <Footer />
            </div>
        </>
    )
}

export default HomePage
