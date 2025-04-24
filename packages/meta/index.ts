import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

export interface Meta {
  name: string;
  chineseName: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
  birthday: string;
  content: string;
  link: Record<string, string>;
  location: string;
  bio: string;
  startWork: string;
  timeline: {
    id: number;
    type: "work" | "education" | "other";
    title: string;
    company: string;
    duration: string;
    startTime: string | number | Dayjs | null;
    endTime: string | number | Dayjs | null;
    location: string;
    work?: string;
    link?: string;
    description?: string;
    detail?: string[];
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
  chineseName: "俞又嘉",
  fullName: "Yu Chia, Yu",
  title: "Full Stack Engineer",
  email: "yuyuchia7423@gmail.com",
  phone: "+886 970227360",
  birthday: "1999-11-04",
  content:
    "I am Yu Chia, Yu, a full-stack engineer with one year of experience in web development",
  link: {
    github: "https://github.com/Chia1104",
    linkedin: "https://link.chia1104.dev/in",
    instagram: "https://link.chia1104.dev/ig",
    youtube_playlist:
      "https://www.youtube.com/playlist?list=PL7XkMe5ddX9Napk5747U6SIOAqWJBsqVM",
    google_photos: "https://photos.app.goo.gl/J1FobfgynJKW84Dm6",
    leadbest: "https://www.leadbestconsultant.com/",
  },
  location: "Taipei, Taiwan",
  bio: "An impassioned full-stack engineer.",
  startWork: "2022-7",
  timeline: [
    {
      id: 3,
      type: "work",
      title: "Work Experience",
      company: "LeadBest",
      duration: "2023-3 - Present",
      startTime: "2023-3",
      endTime: 0,
      location: "Taipei, Taiwan",
      work: "ReactJS, React Native, NextJS, TailwindCSS, TypeScript, GCP, Scrum, Jira",
      link: "https://www.leadbestconsultant.com/",
      description:
        "I am responsible for the development of the company's official website and maintaining related modules.",
      detail: [
        "Adopting the Scrum development process and effectively fulfilling customer requirements with the help and communication of cross-functional teams.",
        "Creating new frontend projects using internal templates and maintaining related modules.",
        "Maintaining the Donkin project — a platform that uses AI to search and analyze real-time crypto news. It displays KOL trading signals directly on candlestick charts to help users understand whether a cryptocurrency is trending bullish or bearish.",
        "Independently assisted external teams with project development and integrated GitHub Actions to accelerate their CI/CD process.",
        "Helped the team adopt Vite and Next.js to improve development speed across various projects.",
      ],
    },
    {
      id: 2,
      type: "work",
      title: "Work Experience",
      company: "WANIN",
      duration: "2022-7 - 2023-1",
      startTime: "2022-7",
      endTime: "2023-1",
      location: "Taipei, Taiwan",
      work: "NextJS, VueJS, NestJS, TailwindCSS, TypeScript, Turborepo, GCP",
      link: "https://www.wanin.tw/",
      detail: [
        "Developed a full-stack project, League Funny, which is a website where users can share posts about their favorite games.",
        "Led the development of the NextJS frontend and backend services, including code review, feature planning, and testing.",
        "Reduced 50% of the development time by using Turborepo to manage multiple repositories.",
        "Developed useful hooks such as useS3ImageUpload and useInfiniteScroll to streamline development.",
        "Led other developers to learn and use new technologies and React features.",
        "Develop an internal backend system for the company to manage game player-related data and use Vue3 to complete the frontend and NestJS to complete the backend API.",
      ],
    },
    {
      id: 1,
      type: "education",
      title: "Education",
      company: "CGU, IM",
      duration: "2018-6 - 2022-6",
      startTime: "2018-6",
      endTime: "2022-6",
      location: "Taipei, Taiwan",
      work: "MIS, Java, Python, MySQL, Computer Science, System Design",
      link: "https://im.cgu.edu.tw/",
    },
    {
      id: 0,
      type: "other",
      title: "Hello World",
      company: "Chia1104",
      duration: "1999-11-04 - Present",
      startTime: "1999-11-04",
      endTime: 0,
      location: "Taipei, Taiwan",
    },
  ],
} satisfies Meta;
