import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { AnimatePresence } from "framer-motion";
import { NavBar } from "../components/globals/NavBar";

function ChiaWEB({ Component, pageProps, router }: AppProps) {
  return (
      <AnimatePresence exitBeforeEnter>
          <NavBar/>
          <Component {...pageProps} key={router.route} />
      </AnimatePresence>
  )
}

export default ChiaWEB
