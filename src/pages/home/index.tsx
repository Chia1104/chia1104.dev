import type { NextPage } from 'next'
import { Head } from "../../components/globals/Layout/Head";
import { Footer } from "../../components/globals/Layout/Footer";
import { AboutMe } from "../../components/pages/home/AboutMe";
import { SocialIcon } from "../../components/pages/home/SocialIcon";
import { ChiaTimeLine } from "../../components/pages/home/ChiaTimeLine";

const HomePage: NextPage = () => {
    return (
        <>
            <Head
                title="Chia WEB"
                description="Yu Yu, Chia, 俞又嘉, WEB developer, UI/UX"
            />
            <main className="main">
                <div className="absolute top-0 left-0 z-10 overflow-visible rotate-12">
                    <h1 className="text-white/10 text-9xl bg-repeat">
                    </h1>
                </div>
                <div className="c-container">
                    <AboutMe />
                    <SocialIcon />
                </div>
            </main>
            <article>
                <div className="c-container">
                </div>
            </article>
            <div className="c-container">
                <Footer />
            </div>
        </>
    )
}

export default HomePage
