import type { FC, ReactNode } from "react";

import { getTranslations } from "next-intl/server";

import meta from "@chia/meta";
import FadeIn from "@chia/ui/fade-in";
import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";
import Link from "@chia/ui/link";

import type { I18N } from "@/utils/i18n";

const contact = {
  github: {
    name: "Github",
    icon: <span className="i-mdi-github size-5" />,
    link: meta.link.github,
  },
  instagram: {
    name: "Instagram",
    icon: <span className="i-mdi-instagram size-5" />,
    link: meta.link.instagram,
  },
  linkedin: {
    name: "Linkedin",
    icon: <span className="i-mdi-linkedin size-5" />,
    link: meta.link.linkedin,
  },
};

const LinkItem: FC<{
  path: string;
  icon: ReactNode;
  name: string;
  showIcon?: boolean;
  locale?: I18N;
}> = ({ path, icon, name, showIcon: _showIcon, locale }) => {
  return (
    <Link
      locale={locale}
      key={path}
      href={path}
      target="_blank"
      className="flex align-middle text-sm transition-all hover:text-neutral-800 dark:hover:text-neutral-200">
      <span className="relative flex items-center justify-center gap-2 px-[7px] py-[5px]">
        <div>{icon}</div>
        <p>{name}</p>
      </span>
    </Link>
  );
};

const Page = async () => {
  const t = await getTranslations("home");
  return (
    <article className="main c-container prose dark:prose-invert mt-20 max-w-[700px] items-start">
      <FadeIn className="w-full flex-col">
        <h1 className="text-start font-bold">{meta.name}</h1>
        <p>{t("section1")}</p>
        <p>
          Working at{" "}
          <Link preview href={meta.link.leadbest} target="_blank">
            LeadBest
          </Link>
          . I am responsible for the development of the company's official
          website and maintaining related modules.
        </p>
        <ul>
          <li>
            Adopting the Scrum development process and effectively fulfilling
            customer requirements with the help and communication of
            cross-functional teams.
          </li>
          <li>
            Creating new frontend projects using internal templates and
            maintaining related modules.
          </li>
        </ul>
      </FadeIn>

      <FadeIn className="w-full flex-col">
        <p>
          Additionally, I actively participate in open-source projects online,
          gaining experience in document writing and feature enhancements.
          During my leisure time, I explore new technologies to complete my own
          side projects.
        </p>
        <p>
          I possess a knack for rapid learning to solve problems and exhibit a
          high level of resilience. I dare to step out of my comfort zone and
          embrace new endeavors. I am passionate about acquiring knowledge in
          emerging technologies and finding fulfillment in their achievements.
          Furthermore, I take pleasure in sharing my skills with others.
        </p>
      </FadeIn>
      <FadeIn className="w-full">
        <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          <ImageZoom>
            <div className="not-prose aspect-h-9 aspect-w-16 relative w-full overflow-hidden rounded-lg">
              <Image
                src="/me/me.JPG"
                alt={meta.name}
                className="object-cover"
                fill
                loading="lazy"
              />
            </div>
          </ImageZoom>
          <div className="c-bg-third relative flex w-full flex-col overflow-hidden rounded-lg">
            <ul>
              <li className="text-sm">
                <span className="font-bold">Full Name: </span>
                <span>{meta.fullName}</span>
              </li>
              <li className="text-sm">
                <span className="font-bold">Email: </span>
                <span>
                  <Link scroll={false} href="/email">
                    {meta.email}
                  </Link>
                </span>
              </li>
            </ul>
            <div className="flex px-2">
              {Object.entries(contact).map(([key, { name, icon, link }]) => (
                <LinkItem
                  key={key}
                  path={link}
                  name={name}
                  icon={icon}
                  showIcon
                />
              ))}
            </div>
            <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 size-full opacity-50 blur-3xl" />
          </div>
        </div>
      </FadeIn>
    </article>
  );
};

export default Page;
