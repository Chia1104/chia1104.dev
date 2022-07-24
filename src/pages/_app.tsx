import "../styles/globals.css";
import type { AppProps } from "next/app";
import { AnimatePresence } from "framer-motion";
import NavMenu from "@chia/components/globals/NavMenu";
import ActionIcon from "@chia/components/globals/ActionIcon";
import { DefaultSeo } from "next-seo";
import SEO from "../../next-seo.config";
import { Footer } from "@chia/components/globals/Footer";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@chia/components/globals/ErrorBoundary";
import { Provider } from "react-redux";
import { store } from "@chia/store";
import NextNProgress from "nextjs-progressbar";
import { nextProgressConfig } from "@chia/utils/config/nextProgress.config";
import { SnackbarProvider } from "notistack";
import { BASE_URL } from "@chia/utils/constants";
import { Background } from "@chia/components/globals/Background";

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
          <SnackbarProvider maxSnack={3}>
            <DefaultSeo canonical={canonical} {...SEO} />
            <NavMenu />
            <ActionIcon />
            <Background />
            <AnimatePresence exitBeforeEnter>
              <Component {...pageProps} key={router.route} />
            </AnimatePresence>
            <Footer />
          </SnackbarProvider>
        </Provider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default ChiaWEB;
