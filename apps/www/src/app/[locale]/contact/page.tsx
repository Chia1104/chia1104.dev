import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { FC, ReactNode } from "react";
import { ViewTransition } from "react";

import meta from "@chia/meta";

import PreviewLink from "@/components/commons/preview-link";
import Contact from "@/components/contact/contact";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return {
    title: t("contact-me"),
  };
}

/**
 * Tokyo, Japan
 */
export const preferredRegion = ["hnd1"];

const contact = {
  github: {
    name: "Github",
    icon: <span className="i-mdi-github size-6" />,
    link: meta.link.github,
  },
  instagram: {
    name: "Instagram",
    icon: <span className="i-mdi-instagram size-6" />,
    link: meta.link.instagram,
  },
  linkedin: {
    name: "Linkedin",
    icon: <span className="i-mdi-linkedin size-6" />,
    link: meta.link.linkedin,
  },
};

const LinkItem: FC<{
  path: string;
  icon: ReactNode;
  name: string;
  showIcon?: boolean;
  preview?: boolean;
}> = ({ path, icon, name, showIcon: _showIcon, preview }) => {
  return (
    <PreviewLink
      enabled={preview}
      key={path}
      href={path}
      target="_blank"
      className="flex align-middle transition-all hover:text-neutral-800 dark:hover:text-neutral-200">
      <span className="relative flex items-center justify-center gap-2 px-[7px] py-[5px]">
        <div>{icon}</div>
        <p>{name}</p>
      </span>
    </PreviewLink>
  );
};

const ContactPage = async () => {
  const t = await getTranslations("contact");
  return (
    <ViewTransition>
      <article className="prose dark:prose-invert mt-20 max-w-[700px] items-start">
        <h1>
          {t("title")}{" "}
          <span className="animate-cia-waving-hand inline-block origin-[70%_70%]">
            👋
          </span>
        </h1>
        <p>{t("description")}</p>
        <h3>{t("find-me-on")}</h3>
        <div className="mb-5 flex px-1">
          {Object.entries(contact).map(([key, { name, icon, link }]) => (
            <LinkItem
              key={key}
              path={link}
              name={name}
              icon={icon}
              showIcon
              preview={key === "github"}
            />
          ))}
        </div>
        <Contact />
      </article>
    </ViewTransition>
  );
};

export default ContactPage;
