import { type ReactNode } from "react";
import type { Metadata } from "next";
import { Chia } from "@/shared/meta/chia";

export const revalidate = 60;
export const runtime = "edge";

export const metadata: Metadata = {
  title: "Portfolio",
  description: `${Chia.content} Welcome to my portfolio page. I always try to make the best of my time.`,
};

export default function Layout(props: {
  children: ReactNode;
  github: ReactNode;
  youtube: ReactNode;
  design: ReactNode;
}) {
  return (
    <article className="main c-container">
      <header className="title pt-10 sm:self-start">
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          GitHub Repositories
        </span>
      </header>
      <p className="c-description pb-7 sm:self-start">
        What I currently working on.
      </p>
      {props.github}
      <hr className="c-border-primary my-10 w-full border-t-2" />
      <header className="title c-text-bg-sec-half dark:c-text-bg-primary-half sm:self-start">
        Youtube Playlists
      </header>
      <p className="c-description pb-7 sm:self-start">
        I have created a few video for my Youtube channel.
      </p>
      {props.youtube}
      <hr className="c-border-primary my-10 w-full border-t-2" />
      {props.design}
      {props.children}
    </article>
  );
}
