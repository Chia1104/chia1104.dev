import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { motion } from "framer-motion";

function ChiaWEB({ Component, pageProps, router }: AppProps) {
  return (
      // SSR will be opacity 0
      <motion.div
          key={router.route}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
      >
        <Component {...pageProps} />
      </motion.div>

      // <Component {...pageProps} />
  )
}

export default ChiaWEB
