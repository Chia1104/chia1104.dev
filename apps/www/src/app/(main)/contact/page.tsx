import Contact from "./contact";
import type { Metadata } from "next";
import "./style.css";
import Link from "next/link";
import meta from "@chia/meta";
import type { FC, ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact Me",
};

/**
 * Tokyo, Japan
 */
export const preferredRegion = ["hnd1"];

const contact = {
  github: {
    name: "Github",
    icon: <span className="i-mdi-github h-6 w-6" />,
    link: meta.link.github,
  },
  instagram: {
    name: "Instagram",
    icon: <span className="i-mdi-instagram h-6 w-6" />,
    link: meta.link.instagram,
  },
  linkedin: {
    name: "Linkedin",
    icon: <span className="i-mdi-linkedin h-6 w-6" />,
    link: meta.link.linkedin,
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
