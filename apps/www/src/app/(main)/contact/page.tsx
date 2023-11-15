import Contact from "./contact";
import type { Metadata } from "next";
import "./style.css";
import Link from "next/link";
import { SiGithub, SiInstagram, SiLinkedin } from "react-icons/si";
import { Chia } from "@/shared/meta/chia";
import type { FC, ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact Me",
};

const contact = {
  github: {
    name: "Github",
    icon: <SiGithub />,
    link: Chia.link.github,
  },
  instagram: {
    name: "Instagram",
    icon: <SiInstagram />,
    link: Chia.link.instagram,
  },
  linkedin: {
    name: "Linkedin",
    icon: <SiLinkedin />,
    link: Chia.link.linkedin,
  },
};

const LinkItem: FC<{
  path: string;
  icon: ReactNode;
  name: string;
  showIcon?: boolean;
}> = ({ path, icon, name, showIcon }) => {
  return (
    <Link
      key={path}
      href={path}
      target="_blank"
      className="flex align-middle transition-all hover:text-neutral-800 dark:hover:text-neutral-200">
      <span className="relative flex items-center justify-center gap-2 px-[7px] py-[5px]">
        <div>{icon}</div>
        <p>{name}</p>
      </span>
    </Link>
  );
};

const ContactPage = () => {
  return (
    <article className="main c-container prose dark:prose-invert mt-20 max-w-[700px] items-start">
      <h1>
        Contact{" "}
        <span className="animate-waving-hand inline-block origin-[70%_70%]">
          👋
        </span>
      </h1>
      <p>
        If you want to get in touch with me, you can send me an email first and
        we can go from there. I'm always open to new opportunities and support
        requests.
      </p>
      <h3>Find me on</h3>
      <div className="mb-5 flex px-1">
        {Object.entries(contact).map(([key, { name, icon, link }]) => (
          <LinkItem key={key} path={link} name={name} icon={icon} showIcon />
        ))}
      </div>
      <Contact />
    </article>
  );
};

export default ContactPage;
