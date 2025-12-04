import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

const AboutPage = (props: LayoutProps<"/[locale]/about">) => {
  return (
    <article className="prose dark:prose-invert mt-20 max-w-[700px] items-start">
      {props.children}
    </article>
  );
};

export default AboutPage;
