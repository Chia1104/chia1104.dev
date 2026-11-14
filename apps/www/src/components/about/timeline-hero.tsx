"use client";

import { memo } from "react";

import { useTranslations } from "next-intl";

import meta, { TimelineType, Company } from "@chia/meta";
import type { Period, Role, TimelineEntry } from "@chia/meta";
import Timeline from "@chia/ui/timeline";
import type { TimelineItemData } from "@chia/ui/timeline/types";
import dayjs from "@chia/utils/day";

import { Panel, PanelHeader, PanelTitle } from "@/components/commons/ruled";

import { getCompanyLogo } from "./company-logo";

const PERIOD_FORMAT = "YYYY-MM";

const PeriodText = ({ startTime, endTime }: Period) => {
  const t = useTranslations("profile");
  const end =
    endTime === 0
      ? t("timeline.present")
      : dayjs(endTime).format(PERIOD_FORMAT);
  return `${dayjs(startTime).format(PERIOD_FORMAT)} – ${end}`;
};

/** A single role is shown inline; several roles get `RoleList` and the subtitle shows the whole tenure. */
const EntrySubtitle = ({ entry }: { entry: TimelineEntry }) => {
  const t = useTranslations("profile");
  switch (entry.type) {
    case TimelineType.Work: {
      const [role, ...rest] = entry.roles;
      if (rest.length > 0) return <PeriodText {...entry} />;
      return (
        <>
          {t(`timeline.job-title.${role.title}`)} · <PeriodText {...role} />
        </>
      );
    }
    case TimelineType.Education:
      return (
        <>
          {t("timeline.education")} · <PeriodText {...entry} />
        </>
      );
    case TimelineType.Other:
      return (
        <>
          {t("timeline.hello-world")} · <PeriodText {...entry} />
        </>
      );
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
};

const RoleList = ({ roles }: { roles: Role[] }) => {
  const t = useTranslations("profile");
  return (
    <ol className="border-separator space-y-1 border-l pl-3">
      {roles.map((role) => (
        <li
          key={`${role.title}-${String(role.startTime)}`}
          className="flex flex-wrap gap-x-2">
          <span className="font-medium">
            {t(`timeline.job-title.${role.title}`)}
          </span>
          <span className="text-muted">
            <PeriodText {...role} />
          </span>
        </li>
      ))}
    </ol>
  );
};

const DETAILS_CLASS_NAME = "marker:text-muted list-disc space-y-1 pl-5";

const WorkDetails = memo(
  ({ company }: { company: Company }) => {
    const tProfile = useTranslations("profile");

    switch (company) {
      case Company.LeadBest:
        return (
          <ul className={DETAILS_CLASS_NAME}>
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
          <ul className={DETAILS_CLASS_NAME}>
            <li>{tProfile("timeline.wanin.detail.1")}</li>
            <li>{tProfile("timeline.wanin.detail.2")}</li>
            <li>{tProfile("timeline.wanin.detail.3")}</li>
            <li>{tProfile("timeline.wanin.detail.4")}</li>
            <li>{tProfile("timeline.wanin.detail.5")}</li>
          </ul>
        );
      default:
        return null;
    }
  },
  (prev, next) => prev.company === next.company
);

/** Companies `WorkDetails` renders, so the others get no empty "More" toggle. */
const COMPANIES_WITH_DETAILS = new Set<Company>([
  Company.LeadBest,
  Company.Wanin,
]);

export function TimelineHero() {
  const t = useTranslations("about");
  const transformData = meta.timeline.map((item) => {
    const hasDetails =
      item.type === TimelineType.Work &&
      item.companyKey &&
      COMPANIES_WITH_DETAILS.has(item.companyKey);

    return {
      id: item.id,
      icon: getCompanyLogo(item.companyKey),
      title: item.company,
      subtitle: <EntrySubtitle entry={item} />,
      description: item.type === TimelineType.Work && item.roles.length > 1 && (
        <RoleList roles={item.roles} />
      ),
      startDate: item.startTime,
      content: hasDetails && item.companyKey && (
        <WorkDetails company={item.companyKey} key={item.id} />
      ),
      link: item.link,
    };
  }) satisfies TimelineItemData[];
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t("timeline")}</PanelTitle>
      </PanelHeader>
      <Timeline data={transformData} />
    </Panel>
  );
}
