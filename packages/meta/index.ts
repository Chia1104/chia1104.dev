import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

export const TimelineType = {
  Work: "work",
  Education: "education",
  Other: "other",
} as const;

export type TimelineType = (typeof TimelineType)[keyof typeof TimelineType];

export const Company = {
  LeadBest: "leadbest",
  Wanin: "wanin",
  CGU: "cgu",
  Chia1104: "chia1104",
} as const;

export type Company = (typeof Company)[keyof typeof Company];

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
  timeline: {
    id: number;
    type: TimelineType;
    company: string;
    companyKey?: Company;
    duration: string;
    startTime: string | number | Dayjs | null;
    endTime: string | number | Dayjs | null;
    work?: string;
    link?: string;
  }[];
}

export const getLatestWork = (timeline: Meta["timeline"]) => {
  return timeline.find((item) => item.type === "work" && item.endTime === 0);
};

export const getFirstWork = (timeline: Meta["timeline"]) => {
  const workItems = timeline.filter((item) => item.type === "work");
  return workItems.reduce(
    (earliest, current) => {
      if (!earliest) return current;

      const earliestTime = dayjs(earliest.startTime);
      const currentTime = dayjs(current.startTime);

      return earliestTime.isBefore(currentTime) ? earliest : current;
    },
    null as Meta["timeline"][0] | null
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
  email: "yuyuchia7423@gmail.com",
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
      id: 3,
      type: TimelineType.Work,
      company: "LeadBest",
      companyKey: Company.LeadBest,
      duration: "2023-3 - Present",
      startTime: "2023-3",
      endTime: 0,
      work: "TypeScript, React, NextJS, React Native, Vite, TailwindCSS, TradingView, EChart, Docker",
      link: "https://www.leadbestconsultant.com/",
    },
    {
      id: 2,
      type: TimelineType.Work,
      company: "WANIN",
      companyKey: Company.Wanin,
      duration: "2022-7 - 2023-1",
      startTime: "2022-7",
      endTime: "2023-1",
      work: "TypeScript, Turborepo, React, Vue3, NextJS, Vite, TailwindCSS, EChart, NestJS, TypeORM, PostgreSQL, Docker, GCP",
      link: "https://www.wanin.tw/",
    },
    {
      id: 1,
      type: TimelineType.Education,
      company: "CGU, IM",
      companyKey: Company.CGU,
      duration: "2018-6 - 2022-6",
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
      duration: "1999-11-04 - Present",
      startTime: "1999-11-04",
      endTime: 0,
    },
  ],
} satisfies Meta;
