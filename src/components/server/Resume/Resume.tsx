import { type FC } from "react";
import { Chia } from "@chia/shared/meta/chia";
import Experience from "../Experience";
import LanAndTools from "../LanAndTools";
import { ContactButton, Image } from "@chia/components/client";
import { MDXLink as Link } from "@chia/components/client/MDXComponents/MDXLink";

interface Props {
  avatarSrc: string;
}

const Resume: FC<Props> = ({ avatarSrc }) => {
  const name = Chia.name;
  const chineseName = Chia.chineseName;
  const title = Chia.title;
  const content = Chia.content;
  const fullName = Chia.fullName;
  const phone = Chia.phone;
  const email = Chia.email;

  return (
    <div className="flex flex-col w-full">
      <div className="flex max-w-[800px] self-center flex-col md:flex-row mb-10">
        <div className="md:w-[40%] w-full flex justify-center items-center">
          <div className="w-[150px] h-[150px] rounded-full overflow-hidden c-border-primary border-2 flex justify-center items-center">
            <Image
              src={avatarSrc || "/favicon.ico"}
              alt="Chia1104"
              width={400}
              height={300}
              priority
            />
          </div>
        </div>
        <div className="md:w-[60%] w-full flex flex-col mt-10 md:mt-0">
          <h1 className="title text-center md:text-left pb-5 flex-wrap">
            <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
              {name} {chineseName}{" "}
            </span>
            <span className="animate-waving-hand origin-[70%_70%] inline-block">
              👋
            </span>
          </h1>
        </div>
      </div>
      <div className="mb-10 max-w-[800px] self-center">
        <p className="c-description pb-5 indent-4">
          I am a full-stack engineer with one year of experience in web
          development, including experience in real business production. My
          expertise lies in NextJS frontend development and backend services
          management. I excel in project management, code review, feature
          planning, and testing.
        </p>
      </div>
      <div className="w-full flex flex-col items-center">
        <ContactButton />
        <div className="w-[85%] mt-10 lg:w-[50%]">
          <ul className="c-description w-full">
            <li className="mb-3 w-full flex">
              <span className="w-[30%]">Full Name:</span>
              <span className="w-[70%]">
                {fullName} - {chineseName}
              </span>
            </li>
            <li className="mb-3 w-full flex">
              <span className="w-[30%]">Title:</span>
              <span className="w-[70%]">{title}</span>
            </li>
            <li className="mb-3 w-full flex">
              <span className="w-[30%]">Phone:</span>
              <span className="w-[70%]">{phone}</span>
            </li>
            <li className="mb-3 w-full flex">
              <span className="w-[30%]">Email:</span>
              <span className="w-[70%]">{email}</span>
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
