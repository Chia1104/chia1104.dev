"use client";

import { useTranslations } from "next-intl";

import meta, { getWorkDuration } from "@chia/meta";
import Age from "@chia/ui/age";
import { Avatar, AvatarImage, AvatarFallback } from "@chia/ui/avatar";
import FadeIn from "@chia/ui/fade-in";

import Gallery from "./gallery";

export function AboutMe() {
  const t = useTranslations("about");
  const workDuration = getWorkDuration(meta.timeline);

  return (
    <FadeIn className="w-full flex-col">
      <div className="flex items-end gap-2">
        <Avatar className="size-14">
          <AvatarImage src={meta.avatar} />
          <AvatarFallback>
            <span className="text-sm">{meta.name.charAt(0)}</span>
          </AvatarFallback>
        </Avatar>
        <h2 className="mt-0 mb-0">{meta.name}</h2>
      </div>
      <p>{t("description", { year: workDuration.toString() })}</p>
      <p>
        {t("currently")} <Age birthday={meta.birthday} className="text-xl" />{" "}
        {t("age")}
      </p>
      <Gallery />
      <p>{t("outside-programming")}</p>
    </FadeIn>
  );
}
