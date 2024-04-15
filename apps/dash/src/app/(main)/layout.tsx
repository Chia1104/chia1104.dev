import type { ReactNode } from "react";
import Menu from "./menu";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Menu />
      <main>{children}</main>
    </>
  );
}
