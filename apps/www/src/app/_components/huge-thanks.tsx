"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  useDisclosure,
  Chip,
} from "@nextui-org/react";

import { Image, NeonGradientCard } from "@chia/ui";

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
      icon: (
        <Image
          src="/assets/zeabur.svg"
          width={10}
          height={10}
          alt="zeabur"
          blur={false}
        />
      ),
      link: "https://zeabur.com/",
      classNames: {
        base: "bg-gradient-to-br from-purple-500 to-purple-700",
        content: "drop-shadow shadow-purple text-white",
      },
    },
  ],
  Others: [
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
          blur={false}
        />
      ),
      link: "https://fumadocs.vercel.app/",
      classNames: {
        base: "bg-gradient-to-br from-blue-500 to-blue-700",
        content: "drop-shadow shadow-blue text-white",
      },
    },
    {
      name: "NextUI",
      icon: <span className="i-simple-icons-nextui" />,
      link: "https://nextui.org/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
    {
      name: "Shadcn/ui",
      icon: <span className="i-simple-icons-shadcnui" />,
      link: "https://ui.shadcn.com/",
      classNames: {
        base: "bg-gradient-to-br from-black to-gray-900",
        content: "drop-shadow shadow-black text-white",
      },
    },
    {
      name: "tRPC",
      icon: <span className="i-devicon-trpc" />,
      link: "https://trpc.io/",
      classNames: {
        base: "bg-gradient-to-br from-blue-500 to-blue-700",
        content: "drop-shadow shadow-blue text-white",
      },
    },
  ],
};

const HugeThanks = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  return (
    <>
      <NeonGradientCard
        className="w-fit h-fit p-0"
        innerBoxProps={{
          className: "p-0",
        }}>
        <Button
          onPress={onOpen}
          className="dark:text-white text-black bg-transparent w-fit">
          Huge Thanks
        </Button>
      </NeonGradientCard>
      <Modal backdrop="blur" isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 text-center text-xl">
            Huge Thanks to all the tech providers! 🎉
          </ModalHeader>
          <ModalBody className="prose dark:prose-invert prose-img:m-0">
            <ul>
              {Object.entries(techStack).map(([key, value]) => (
                <li key={key}>
                  <span className="flex flex-wrap gap-2 items-center">
                    {key}:{"  "}
                    {value.map((item) => (
                      <Chip
                        size="sm"
                        key={item.name}
                        variant="shadow"
                        classNames={item.classNames}>
                        <span className="flex items-center gap-1 relative">
                          {item.icon}
                          {item.name}
                          <a
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
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default HugeThanks;
