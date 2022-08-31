import "../styles/globals.css";
import type { AppProps } from "next/app";
import { AnimatePresence } from "framer-motion";
import {
  NavMenu,
  ActionIcon,
  Footer,
  ErrorBoundary,
  Background,
} from "@chia/components/shared";
import { DefaultSeo } from "next-seo";
import SEO from "../../next-seo.config";
import { ThemeProvider } from "next-themes";
import { Provider } from "react-redux";
import { store } from "@chia/store";
import NextNProgress from "nextjs-progressbar";
import { nextProgressConfig } from "@chia/config/nextProgress.config";
import { BASE_URL } from "@chia/shared/constants";
import { GeistProvider } from "@geist-ui/core";

function ChiaWEB({ Component, pageProps, router }: AppProps) {
  const canonical = `${BASE_URL}${
    router.pathname === "/" ? "" : router.pathname
  }/`;

  return (
    <ErrorBoundary>
      <NextNProgress
        {...nextProgressConfig}
        options={{ easing: "ease", speed: 500 }}
      />
      <ThemeProvider enableSystem={true} attribute="class">
        <Provider store={store}>
          <GeistProvider>
            <DefaultSeo canonical={canonical} {...SEO} />
            <NavMenu />
            <ActionIcon />
            <Background />
            <AnimatePresence exitBeforeEnter>
              <Component {...pageProps} key={router.route} />
            </AnimatePresence>
            <Footer />
          </GeistProvider>
        </Provider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default ChiaWEB;
