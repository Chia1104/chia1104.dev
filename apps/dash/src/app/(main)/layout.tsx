import type { ReactNode } from "react";
import Menu from "./menu";
import { Page } from "@chia/ui";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Menu />
      <Page>{children}</Page>
    </>
  );
}
