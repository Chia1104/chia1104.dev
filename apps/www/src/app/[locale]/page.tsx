import { Suspense, ViewTransition } from "react";
import type { FC, ReactNode } from "react";

import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

import meta, { getLatestWork, getWorkDuration } from "@chia/meta";
import FadeIn from "@chia/ui/fade-in";
import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";
import Link from "@chia/ui/link";

const contact = {
  github: {
    name: "Github",
    icon: <span className="i-mdi-github size-5" />,
    link: meta.link.github,
  },
  bluesky: {
    name: "BlueSky",
    icon: <span className="i-simple-icons-bluesky size-4" />,
    link: meta.link.bluesky,
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
  locale?: Locale;
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

const WorkDuration = async () => {
  const t = await getTranslations("home");
  const workDuration = getWorkDuration(meta.timeline);
  return <p>{t("section1", { year: workDuration.toString() })}</p>;
};

const Page = async ({ params }: { params: PageParamsWithLocale }) => {
  const { locale } = await params;
  const latestWork = getLatestWork(meta.timeline);
  return (
    <ViewTransition>
      <article className="prose dark:prose-invert mt-20 max-w-[700px] items-start">
        <FadeIn className="w-full flex-col">
          <h1 className="text-start font-bold">{meta.name}</h1>
          <Suspense>
            <WorkDuration />
          </Suspense>
          <div>
            Working at{" "}
            <Link
              preview
              href={latestWork?.link || meta.link.leadbest}
              target="_blank">
              {latestWork?.company || "LeadBest"}
            </Link>
            . {latestWork?.description}
          </div>
          <ul>
            {latestWork?.detail?.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn className="w-full flex-col">
          <p>
            Additionally, I actively participate in open-source projects online,
            gaining experience in document writing and feature enhancements.
            During my leisure time, I explore new technologies to complete my
            own side projects.
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
                  src="https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/me.JPG"
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
                    <Link scroll={false} href="/email" locale={locale}>
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
    </ViewTransition>
  );
};

export default Page;
