"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@heroui/react";
import { useTranslations } from "next-intl";

import meta, { getWorkDuration } from "@chia/meta";
import Age from "@chia/ui/age";

import { Panel } from "@/components/commons/ruled";

import Gallery from "./gallery";

export function AboutMe() {
  const t = useTranslations("about");
  const workDuration = getWorkDuration(meta.timeline);

  return (
    <Panel data-testid="hero-section">
      <div className="rule-b flex">
        <Avatar className="page-sm:size-28 border-separator size-20 shrink-0 rounded-none border-r">
          <AvatarImage src={meta.avatar} />
          <AvatarFallback className="rounded-none">
            <span className="text-2xl">{meta.name.charAt(0)}</span>
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col justify-end">
          <h1
            className="page-sm:text-4xl rule-b px-4 pb-1 text-3xl leading-tight font-semibold tracking-tight"
            data-testid="about-me-name">
            {meta.name}
          </h1>
          <p className="text-muted px-4 py-2 text-sm tabular-nums">
            {t("currently")} <Age birthday={meta.birthday} /> {t("age")}
          </p>
        </div>
      </div>
      <p className="rule-b p-4 leading-relaxed text-pretty">
        {t("description", { year: workDuration.toString() })}
      </p>
      <Gallery />
      <p className="text-muted p-4 leading-relaxed text-pretty">
        {t("outside-programming")}
      </p>
    </Panel>
  );
}
