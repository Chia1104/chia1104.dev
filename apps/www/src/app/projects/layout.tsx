import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <article className="main c-container prose dark:prose-invert mt-20">
      <h1>Projects</h1>
      <p>
        I love to build things. Here are some of the projects I've worked on
        recently.
      </p>
      {children}
    </article>
  );
}
