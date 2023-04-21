import { type FC } from "react";
import { Chia } from "@/shared/meta/chia.ts";
import Experience from "./Experience.tsx";
import LanAndTools from "./LanAndTools.tsx";
import { Link, Image } from "ui";

interface Props {
  avatarSrc?: string;
}

const Resume: FC<Props> = ({ avatarSrc }) => {
  const name = Chia.name;
  const chineseName = Chia.chineseName;
  const title = Chia.title;
  const fullName = Chia.fullName;
  const phone = Chia.phone;
  const email = Chia.email;

  return (
    <div className="flex w-full flex-col">
      <div className="mb-10 flex max-w-[800px] flex-col items-center justify-center gap-5 self-center md:flex-row">
        <div className="flex w-full items-center justify-center md:w-[30%]">
          <div className="c-border-primary flex h-[150px] w-[150px] items-center justify-center overflow-hidden rounded-full border-2">
            <Image
              src={avatarSrc || "/favicon.ico"}
              alt="Chia1104"
              width={400}
              height={300}
              priority
            />
          </div>
        </div>
        <div className="mt-10 flex w-full flex-col md:mt-0 md:w-[70%]">
          <h1 className="title flex-wrap pb-5 text-center md:text-left">
            <span className="c-text-bg-sec-half dark:c-text-bg-primary-half mr-5">
              {name} {chineseName}{" "}
            </span>
            <span className="animate-waving-hand inline-block origin-[70%_70%]">
              👋
            </span>
          </h1>
        </div>
      </div>
      <div className="mb-10 max-w-[750px] self-center">
        <p className="c-description pb-5 indent-4">
          I am a full-stack engineer with one year of experience in web
          development, including experience in real business production. My
          expertise lies in NextJS frontend development and backend services
          management. I excel in project management, code review, feature
          planning, and testing.
        </p>
      </div>
      <div className="flex w-full flex-col items-center">
        <div className="mt-10 w-[85%] lg:w-[50%]">
          <ul className="c-description w-full">
            <li className="mb-3 flex w-full">
              <span className="w-[30%]">Full Name:</span>
              <span className="w-[70%]">
                {fullName} - {chineseName}
              </span>
            </li>
            <li className="mb-3 flex w-full">
              <span className="w-[30%]">Title:</span>
              <span className="w-[70%]">{title}</span>
            </li>
            <li className="mb-3 flex w-full">
              <span className="w-[30%]">Phone:</span>
              <span className="w-[70%]">{phone}</span>
            </li>
            <li className="mb-3 flex w-full">
              <span className="w-[30%]">Email:</span>
              <Link href={`mailto:${email}`}>
                <span className="w-[70%]">{email}</span>
              </Link>
            </li>
          </ul>
        </div>
        <div className="mt-20 w-full max-w-[1000px]">
          <LanAndTools />
        </div>
        <div className="mt-20 w-full max-w-[1000px]">
          <Experience />
        </div>
      </div>
    </div>
  );
};

export default Resume;
