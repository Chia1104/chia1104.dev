import type { Dayjs } from "dayjs";

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
  timeline: {
    id: number;
    title: string;
    company: string;
    duration: string;
    startTime: string | number | Dayjs | null;
    endTime: string | number | Dayjs | null;
    location: string;
    work?: string;
    link?: string;
    detail?: string[];
  }[];
}

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
  timeline: [
    {
      id: 3,
      title: "Work Experience",
      company: "LeadBest",
      duration: "2023-3 - Present",
      startTime: "2023-3",
      endTime: 0,
      location: "Taipei, Taiwan",
      work: "ReactJS, React Native, MUI, TypeScript, GCP, Scrum, Jira",
      link: "https://www.leadbestconsultant.com/",
      detail: [
        "Adopting the Scrum development process and effectively fulfilling customer requirements with the help and communication of cross-functional teams.",
        "Creating new frontend projects using internal templates and maintaining related modules.",
      ],
    },
    {
      id: 2,
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
      title: "Hello World",
      company: "Chia1104",
      duration: "1999-11-04 - Present",
      startTime: "1999-11-04",
      endTime: 0,
      location: "Taipei, Taiwan",
    },
  ],
} satisfies Meta;
