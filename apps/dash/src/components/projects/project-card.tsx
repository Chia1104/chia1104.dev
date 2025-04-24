"use client";

import React from "react";

import type { CardProps } from "@heroui/react";
import { Card, CardFooter, Image, CardHeader } from "@heroui/react";
import {
  m,
  useMotionValue,
  domAnimation,
  LazyMotion,
  useMotionTemplate,
} from "framer-motion";
import { useTransitionRouter } from "next-view-transitions";

interface Props extends CardProps {
  name: string;
  image?: string | null;
  description?: string | null;
  slug: string;
}

export default function ProjectCard({
  name,
  image,
  description,
  slug,
  ...props
}: Props) {
  const router = useTransitionRouter();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const cardRef = React.useRef<HTMLDivElement>(null);

  function onMouseMove({
    clientX,
    clientY,
  }: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!cardRef.current?.getBoundingClientRect()) return;

    const { left, top } = cardRef.current.getBoundingClientRect();

    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <Card
      isPressable
      onPress={() => router.push(`/projects/${slug}`)}
      {...props}
      ref={cardRef}
      className="group relative w-full bg-white dark:bg-neutral-900 shadow-large min-h-[250px]"
      radius="lg"
      onMouseMove={onMouseMove}>
      <LazyMotion features={domAnimation}>
        <m.div
          className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-250 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
            radial-gradient(
              450px circle at ${mouseX}px ${mouseY}px,
              rgba(120, 40, 200, 0.2),
              transparent 80%
            )
          `,
          }}
        />
      </LazyMotion>
      <CardHeader className="h-60 p-0 flex justify-center absolute inset-0">
        <Image
          removeWrapper
          alt="Acme Planner"
          className="h-full object-cover"
          src={image ?? "/logo.png"}
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, #000 10%, transparent 100%)",
          }}
        />
      </CardHeader>
      <CardFooter className="px-6 pb-8 pt-4 absolute bottom-0 w-full">
        <div className="flex flex-col gap-2 items-start justify-end">
          <p className="text-lg">{name}</p>
          <p className="text-small text-neutral-400">{description}</p>
        </div>
      </CardFooter>
    </Card>
  );
}
