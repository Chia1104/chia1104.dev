import type { Dayjs } from "dayjs";

import dayjs from "@chia/utils/day";

export const TimelineType = {
  Work: "work",
  Education: "education",
  Other: "other",
} as const;

export type TimelineType = (typeof TimelineType)[keyof typeof TimelineType];

export const Company = {
  Wiwynn: "wiwynn",
  LeadBest: "leadbest",
  Wanin: "wanin",
  CGU: "cgu",
  Chia1104: "chia1104",
} as const;

export type Company = (typeof Company)[keyof typeof Company];

export const JobTitle = {
  SeniorSoftwareEngineer: "senior-software-engineer",
  FrontendEngineer: "frontend-engineer",
  RDEngineer: "rd-engineer",
} as const;

export type JobTitle = (typeof JobTitle)[keyof typeof JobTitle];

/** `endTime: 0` means the period is ongoing. */
export interface Period {
  startTime: string | number | Dayjs | null;
  endTime: string | number | Dayjs | null;
}

export interface Role extends Period {
  title: JobTitle;
}

interface TimelineEntryBase extends Period {
  id: number;
  company: string;
  companyKey?: Company;
  work?: string;
  link?: string;
}

/** Roles are ordered newest first and lie within the entry's period. */
export interface WorkTimelineEntry extends TimelineEntryBase {
  type: typeof TimelineType.Work;
  roles: [Role, ...Role[]];
}

export interface OtherTimelineEntry extends TimelineEntryBase {
  type: typeof TimelineType.Education | typeof TimelineType.Other;
}

export type TimelineEntry = WorkTimelineEntry | OtherTimelineEntry;

export interface Meta {
  name: string;
  avatar: string;
  secondaryAvatar: string;
  chineseName: string;
  fullName: string;
  email: string;
  phone: string;
  birthday: string;
  link: Record<string, string>;
  startWork: string;
  timeline: TimelineEntry[];
}

export const getLatestWork = (timeline: Meta["timeline"]) => {
  return timeline.find(
    (item) => item.type === TimelineType.Work && item.endTime === 0
  );
};

export const getFirstWork = (timeline: Meta["timeline"]) => {
  const workItems = timeline.filter((item) => item.type === TimelineType.Work);
  return workItems.reduce<Meta["timeline"][number] | null>(
    (earliest, current) => {
      if (!earliest) return current;

      const earliestTime = dayjs(earliest.startTime);
      const currentTime = dayjs(current.startTime);

      return earliestTime.isBefore(currentTime) ? earliest : current;
    },
    null
  );
};

export const getWorkDuration = (timeline: Meta["timeline"]) => {
  const firstWork = getFirstWork(timeline);
  if (!firstWork) return "0";
  return dayjs().diff(dayjs(firstWork.startTime), "year");
};

export default {
  name: "Chia1104",
  avatar: "https://storage.chia1104.dev/chia1104.png",
  secondaryAvatar: "https://storage.chia1104.dev/avatar.png",
  chineseName: "俞又嘉",
  fullName: "Yu Chia, Yu",
  email: "contact@chia1104.dev",
  phone: "+886 970227360",
  birthday: "1999-11-04",
  link: {
    github: "https://github.com/Chia1104",
    linkedin: "https://link.chia1104.dev/in",
    instagram: "https://link.chia1104.dev/ig",
    x: "https://link.chia1104.dev/x",
    bluesky: "https://link.chia1104.dev/bs",
    youtube_playlist:
      "https://www.youtube.com/playlist?list=PL7XkMe5ddX9Napk5747U6SIOAqWJBsqVM",
    google_photos: "https://photos.app.goo.gl/J1FobfgynJKW84Dm6",
    leadbest: "https://www.leadbestconsultant.com/",
  },
  startWork: "2022-7",
  timeline: [
    {
      id: 4,
      type: TimelineType.Work,
      company: "Wiwynn",
      companyKey: Company.Wiwynn,
      startTime: "2026-11",
      endTime: 0,
      link: "https://www.wiwynn.com/",
      roles: [
        {
          title: JobTitle.SeniorSoftwareEngineer,
          startTime: "2026-11",
          endTime: 0,
        },
      ],
    },
    {
      id: 3,
      type: TimelineType.Work,
      company: "LeadBest",
      companyKey: Company.LeadBest,
      startTime: "2023-3",
      endTime: "2026-11",
      work: "TypeScript, React, NextJS, React Native, Vite, TailwindCSS, TradingView, EChart, Docker",
      link: "https://www.leadbestconsultant.com/",
      roles: [
        {
          title: JobTitle.FrontendEngineer,
          startTime: "2023-3",
          endTime: "2026-11",
        },
      ],
    },
    {
      id: 2,
      type: TimelineType.Work,
      company: "WANIN",
      companyKey: Company.Wanin,
      startTime: "2022-7",
      endTime: "2023-1",
      work: "TypeScript, Turborepo, React, Vue3, NextJS, Vite, TailwindCSS, EChart, NestJS, TypeORM, PostgreSQL, Docker, GCP",
      link: "https://www.wanin.tw/",
      roles: [
        {
          title: JobTitle.RDEngineer,
          startTime: "2022-7",
          endTime: "2023-1",
        },
      ],
    },
    {
      id: 1,
      type: TimelineType.Education,
      company: "CGU, IM",
      companyKey: Company.CGU,
      startTime: "2018-6",
      endTime: "2022-6",
      work: "MIS, Java, Python, MySQL, Computer Science, System Design",
      link: "https://im.cgu.edu.tw/",
    },
    {
      id: 0,
      type: TimelineType.Other,
      company: "Chia1104",
      companyKey: Company.Chia1104,
      startTime: "1999-11-04",
      endTime: 0,
    },
  ],
} satisfies Meta;
