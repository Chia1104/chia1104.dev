import "../styles/globals.css";
import {
  ActionIcon,
  NavMenu,
  Footer,
  ErrorBoundary,
  Background,
  AnimatePresence,
  ReduxProvider,
} from "@chia/components/shared";
import { type ReactNode } from "react";
import { ThemeProvider } from "@chia/components/shared/NextTheme";

// import { IS_PRODUCTION } from "@chia/shared/constants";
// import { httpBatchLink } from "@trpc/client/links/httpBatchLink";
// import { loggerLink } from "@trpc/client/links/loggerLink";
// import { withTRPC } from "@trpc/next";
// import { AppRouter } from "@chia/server/routers/_app";
// import superjson from "superjson";
// import { getBaseUrl } from "@chia/utils/getBaseUrl";

const ChiaWEB = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="zh-Hant-TW">
      <body className="c-bg-primary scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full">
        <ErrorBoundary>
          <ThemeProvider enableSystem={true} attribute="class">
            <ReduxProvider>
              <NavMenu />
              <ActionIcon />
              <Background />
              <AnimatePresence mode="wait">{children}</AnimatePresence>
              <Footer />
            </ReduxProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
};

export default ChiaWEB;

// export default withTRPC<AppRouter>({
//   config() {
//     return {
//       links: [
//         loggerLink({
//           enabled: (opts) =>
//             !IS_PRODUCTION ||
//             (opts.direction === "down" && opts.result instanceof Error),
//         }),
//         httpBatchLink({
//           url: `${getBaseUrl()}/api/trpc`,
//         }),
//       ],
//       transformer: superjson,
//     };
//   },
//   ssr: true,
//   responseMeta({ clientErrors }) {
//     if (clientErrors.length) {
//       return {
//         status: clientErrors[0].data?.httpStatus ?? 500,
//       };
//     }
//     return {};
//   },
// })(ChiaWEB);
