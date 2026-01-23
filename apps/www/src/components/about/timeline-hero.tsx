"use client";

import { useTranslations } from "next-intl";

import meta, {
  TimelineType,
  Company,
  type TimelineType as TimelineTypeType,
} from "@chia/meta";
import Timeline from "@chia/ui/timeline";
import type { Data } from "@chia/ui/timeline/types";

const getTimelineTitle = (type: TimelineTypeType, t: any) => {
  switch (type) {
    case TimelineType.Work:
      return t("timeline.work-experience");
    case TimelineType.Education:
      return t("timeline.education");
    case TimelineType.Other:
      return t("timeline.hello-world");
  }
};

const getWorkDetails = (companyKey: string | undefined, tMeta: any) => {
  if (!companyKey) return null;

  switch (companyKey) {
    case Company.LeadBest:
      return (
        <ul>
          <li>{tMeta("timeline.leadbest.detail.1")}</li>
          <li>{tMeta("timeline.leadbest.detail.2")}</li>
          <li>{tMeta("timeline.leadbest.detail.3")}</li>
          <li>{tMeta("timeline.leadbest.detail.4")}</li>
          <li>{tMeta("timeline.leadbest.detail.5")}</li>
          <li>{tMeta("timeline.leadbest.detail.6")}</li>
        </ul>
      );
    case Company.Wanin:
      return (
        <ul>
          <li>{tMeta("timeline.wanin.detail.1")}</li>
          <li>{tMeta("timeline.wanin.detail.2")}</li>
          <li>{tMeta("timeline.wanin.detail.3")}</li>
          <li>{tMeta("timeline.wanin.detail.4")}</li>
          <li>{tMeta("timeline.wanin.detail.5")}</li>
          <li>{tMeta("timeline.wanin.detail.6")}</li>
        </ul>
      );
    default:
      return null;
  }
};

export function TimelineHero() {
  const t = useTranslations("about");
  const tProfile = useTranslations("profile");
  const transformData = meta.timeline.map((item) => {
    const hasDetails = item.type === TimelineType.Work && item.companyKey;

    return {
      id: item.id,
      title: item.company,
      subtitle: `${getTimelineTitle(item.type, tProfile)} (${item.duration})`,
      startDate: item.startTime,
      content: hasDetails && getWorkDetails(item.companyKey, tProfile),
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
