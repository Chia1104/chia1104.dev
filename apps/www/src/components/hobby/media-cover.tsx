"use client";

import Image from "next/image";

import { ReflectiveCard } from "@chia/shaders/reflective-card";

import { useReducedEffects } from "@/hooks/use-reduced-effects";

/** A work's cover under studio light, which holds still when the reader's effects are reduced. */
export const MediaCover = ({
  src,
  className,
}: {
  src: string;
  className?: string;
}) => {
  const reducedEffects = useReducedEffects();
  return (
    <ReflectiveCard
      radius={6}
      reducedMotion={reducedEffects}
      className={className}>
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 768px) 224px, 144px"
        referrerPolicy="no-referrer"
        className="object-cover"
      />
    </ReflectiveCard>
  );
};
