import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { AnimatePresence } from "framer-motion";
import { NavMenu } from "../components/globals/NavMenu";

function ChiaWEB({ Component, pageProps, router }: AppProps) {
  return (
      <>
          <NavMenu/>
          <AnimatePresence exitBeforeEnter>
              <Component {...pageProps} key={router.route} />
          </AnimatePresence>
      </>
  )
}

export default ChiaWEB
