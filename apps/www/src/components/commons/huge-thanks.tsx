"use client";

import Image from "next/image";
import Link from "next/link";

import { Modal, Button, Chip } from "@heroui/react";
import { BorderBeam } from "border-beam";

import BetterAuth from "@chia/ui/icons/better-auth";
import Zeabur from "@chia/ui/icons/zeabur";

const techStack = {
  Frameworks: [
    {
      name: "Hono",
      icon: <span className="i-logos-hono" />,
      link: "https://hono.dev/",
      classNames: {
        base: "bg-gradient-to-br from-red-500 to-red-700",
        content: "drop-shadow shadow-red text-white",
      },
    },
    {
      name: "Next.js",
      icon: <span className="i-devicon-nextjs" />,
      link: "https://nextjs.org/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
  ],
  Tools: [
    {
      name: "PNPM",
      icon: <span className="i-devicon-pnpm" />,
      link: "https://pnpm.io/",
      classNames: {
        base: "bg-gradient-to-br from-yellow-400 to-yellow-600",
        content: "drop-shadow shadow-yellow text-white",
      },
    },
    {
      name: "Turborepo",
      icon: <span className="i-logos-turbopack-icon" />,
      link: "https://turbo.build/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
  ],
  Platforms: [
    {
      name: "Railway",
      icon: <span className="i-devicon-railway" />,
      link: "https://railway.app/",
      classNames: {
        base: "bg-gradient-to-br from-purple-500 to-purple-700",
        content: "drop-shadow shadow-purple text-white",
      },
    },
    {
      name: "Vercel",
      icon: <span className="i-ion-logo-vercel" />,
      link: "https://vercel.com/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
    {
      name: "Zeabur",
      icon: <Zeabur className="size-3" />,
      link: "https://zeabur.com/",
      classNames: {
        base: "bg-gradient-to-br from-purple-500 to-purple-700",
        content: "drop-shadow shadow-purple text-white",
      },
    },
  ],
  Techs: [
    {
      name: "BetterAuth",
      icon: <BetterAuth className="size-3" />,
      link: "https://www.better-auth.com/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
    {
      name: "Drizzle",
      icon: <span className="i-simple-icons-drizzle" />,
      link: "https://orm.drizzle.team/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
    {
      name: "Fumadocs",
      icon: (
        <Image
          src="/assets/fumadocs.png"
          width={10}
          height={10}
          alt="fumadocs"
        />
      ),
      link: "https://fumadocs.dev/",
      classNames: {
        base: "bg-gradient-to-br from-blue-500 to-blue-700",
        content: "drop-shadow shadow-blue text-white",
      },
    },
    {
      name: "HeroUI",
      icon: <span className="i-simple-icons-nextui" />,
      link: "https://www.heroui.com/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
    {
      name: "Shadcn/ui",
      icon: <span className="i-simple-icons-shadcnui size-2" />,
      link: "https://ui.shadcn.com/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
  ],
};

const HugeThanks = () => {
  return (
    <>
      <Modal>
        <Modal.Trigger>
          <BorderBeam duration={3.5} size="pulse-inner" theme="light">
            <Button variant="tertiary" className="rounded-full">
              Huge Thanks
            </Button>
          </BorderBeam>
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[360px]">
              <Modal.CloseTrigger className="absolute top-2 right-2" />
              <Modal.Header>
                <Modal.Heading>
                  Huge Thanks to all the tech providers! 🎉
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <ul className="flex flex-col gap-2">
                  {Object.entries(techStack).map(([key, value]) => (
                    <li key={key}>
                      <span className="flex flex-wrap items-center gap-2">
                        {key}:{"  "}
                        {value.map((item) => (
                          <Chip
                            size="sm"
                            key={item.name}
                            className={item.classNames.base}>
                            <span className="relative flex items-center gap-1 text-white">
                              {item.icon}
                              {item.name}
                              <Link
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0"
                              />
                            </span>
                          </Chip>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
};

export default HugeThanks;
