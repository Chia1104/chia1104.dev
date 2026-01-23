"use client";

import { memo } from "react";

import { useTranslations } from "next-intl";

import meta, { TimelineType, Company } from "@chia/meta";
import Timeline from "@chia/ui/timeline";
import type { Data } from "@chia/ui/timeline/types";

const TimelineTitle = memo(
  ({ type, duration }: { type: TimelineType; duration: string }) => {
    const t = useTranslations("profile");
    switch (type) {
      case TimelineType.Work:
        return `${t("timeline.work-experience")} (${duration})`;
      case TimelineType.Education:
        return `${t("timeline.education")} (${duration})`;
      case TimelineType.Other:
        return `${t("timeline.hello-world")} (${duration})`;
    }
  },
  (prev, next) => prev.type === next.type && prev.duration === next.duration
);

const WorkDetails = memo(
  ({ company }: { company?: Company }) => {
    const tProfile = useTranslations("profile");
    if (!company) return null;

    switch (company) {
      case Company.LeadBest:
        return (
          <ul>
            <li>{tProfile("timeline.leadbest.detail.1")}</li>
            <li>{tProfile("timeline.leadbest.detail.2")}</li>
            <li>{tProfile("timeline.leadbest.detail.3")}</li>
            <li>{tProfile("timeline.leadbest.detail.4")}</li>
            <li>{tProfile("timeline.leadbest.detail.5")}</li>
            <li>{tProfile("timeline.leadbest.detail.6")}</li>
          </ul>
        );
      case Company.Wanin:
        return (
          <ul>
            <li>{tProfile("timeline.wanin.detail.1")}</li>
            <li>{tProfile("timeline.wanin.detail.2")}</li>
            <li>{tProfile("timeline.wanin.detail.3")}</li>
            <li>{tProfile("timeline.wanin.detail.4")}</li>
            <li>{tProfile("timeline.wanin.detail.5")}</li>
            <li>{tProfile("timeline.wanin.detail.6")}</li>
          </ul>
        );
      default:
        return null;
    }
  },
  (prev, next) => prev.company === next.company
);

export function TimelineHero() {
  const t = useTranslations("about");
  const transformData = meta.timeline.map((item) => {
    const hasDetails = item.type === TimelineType.Work && item.companyKey;

    return {
      id: item.id,
      title: item.company,
      subtitle: (
        <TimelineTitle
          type={item.type}
          duration={item.duration}
          key={item.id}
        />
      ),
      startDate: item.startTime,
      content: hasDetails && (
        <WorkDetails company={item.companyKey} key={item.id} />
      ),
      link: item.link,
    };
  }) satisfies Data[];
  return (
    <>
      <h2>{t("timeline")}</h2>
      <Timeline data={transformData} />
    </>
  );
}
