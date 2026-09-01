import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";
import type { Locale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";

/**
 * QueryClient with retry and gcTime off so tests don't wait.
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

export const renderWithProviders = (
  ui: React.ReactElement,
  {
    locale = "en-US",
    messages = {},
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: RenderOptions & {
    locale?: Locale;
    messages?: Record<string, string>;
    queryClient?: QueryClient;
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
};

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const waitUntil = async (
  condition: () => boolean,
  timeout = 3000,
  interval = 50
): Promise<void> => {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error("Timeout waiting for condition");
    }
    await delay(interval);
  }
};
