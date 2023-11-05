import { type PropsWithChildren, type ReactElement } from "react";
import { Provider } from "react-redux";
import { render, type RenderOptions } from "@testing-library/react";
import { ReactQueryProvider } from "@/app/root-provider";

interface ExtendedRenderOptions extends Omit<RenderOptions, "queries"> {}

/**
 * @todo
 * @param ui
 * @param renderOptions
 * @returns
 */
export function renderWithProviders(
  ui: ReactElement,
  renderOptions: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: PropsWithChildren): JSX.Element {
    return <ReactQueryProvider>{children}</ReactQueryProvider>;
  }
  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
