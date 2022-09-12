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
import { nextProgressConfig } from "@chia/config/next-progress.config";
import { BASE_URL, RAILWAY_URL } from "@chia/shared/constants";
import { GeistProvider } from "@geist-ui/core";
import { httpBatchLink } from "@trpc/client/links/httpBatchLink";
import { loggerLink } from "@trpc/client/links/loggerLink";
import { withTRPC } from "@trpc/next";
import { AppRouter } from "@chia/server/routers/_app";
import superjson from "superjson";

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

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }

  if (RAILWAY_URL) {
    return RAILWAY_URL;
  }

  return BASE_URL;
}

export default withTRPC<AppRouter>({
  config() {
    return {
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
      transformer: superjson,
    };
  },
  ssr: true,
  responseMeta({ clientErrors }) {
    if (clientErrors.length) {
      return {
        status: clientErrors[0].data?.httpStatus ?? 500,
      };
    }
    return {};
  },
})(ChiaWEB);
