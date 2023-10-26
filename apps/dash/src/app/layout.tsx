import "./globals.css";
import type { ReactNode } from "react";
import { getServerSession } from "@chia/auth";
import RootProvider from "./root-provider";
import { headers } from "next/headers";

export const metadata = {
  title: "Next App",
  description: "Generated by @chia-stack/nextjs-app template",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();
  return (
    <html lang="en">
      <body className="scrollbar-thin scrollbar-thumb-primary dark:scrollbar-thumb-secondary scrollbar-thumb-rounded-full overflow-x-hidden">
        <RootProvider session={session} headers={headers()}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
