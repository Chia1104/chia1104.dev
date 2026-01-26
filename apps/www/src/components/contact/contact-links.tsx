"use client";

import type { FC, ReactNode } from "react";

import meta from "@chia/meta";

import PreviewLink from "@/components/commons/preview-link";

interface ContactLink {
  name: string;
  icon: ReactNode;
  link: string;
  preview?: boolean;
}

const contactLinks: ContactLink[] = [
  {
    name: "Github",
    icon: <span className="i-mdi-github size-6" />,
    link: meta.link.github,
    preview: true,
  },
  {
    name: "Instagram",
    icon: <span className="i-mdi-instagram size-6" />,
    link: meta.link.instagram,
    preview: false,
  },
  {
    name: "Linkedin",
    icon: <span className="i-mdi-linkedin size-6" />,
    link: meta.link.linkedin,
    preview: false,
  },
];

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

const ContactLinks = () => {
  return (
    <div className="mb-5 flex px-1">
      {contactLinks.map(({ name, icon, link, preview }) => (
        <LinkItem
          key={link}
          path={link}
          name={name}
          icon={icon}
          showIcon
          preview={preview}
        />
      ))}
    </div>
  );
};

export default ContactLinks;
