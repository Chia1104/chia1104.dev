import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { AnimatePresence } from "framer-motion";
import { NavMenu } from "../components/globals/NavMenu";
import { ActionIcon } from "../components/globals/ActionIcon";
import { DefaultSeo } from 'next-seo';
import SEO from '../../next-seo.config';
import { Footer } from "../components/globals/Footer";
import { ThemeProvider } from 'next-themes'

function ChiaWEB({ Component, pageProps, router }: AppProps) {
    return (
        <ThemeProvider enableSystem={true} attribute="class">
            <DefaultSeo {...SEO}/>
            <NavMenu/>
            <ActionIcon/>
            <AnimatePresence exitBeforeEnter>
                <Component {...pageProps} key={router.route} />
            </AnimatePresence>
            <Footer/>
        </ThemeProvider>
    )
}

export default ChiaWEB
