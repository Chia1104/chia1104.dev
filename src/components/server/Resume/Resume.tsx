import { type FC } from "react";
import { Chia } from "@chia/shared/meta/chia";
import Experience from "../Experience";
import LanAndTools from "../LanAndTools";
import { ContactButton, Image } from "@chia/components/client";

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
          <h2 className="text-lg text-center md:text-left ">{content}</h2>
        </div>
      </div>
      <div className="mb-10 max-w-[800px] self-center">
        <p className="c-description pb-5 indent-4">
          I am {name}, a full-stack engineer with one year of experience in web
          development. Including more than once experience in real business
          production.
        </p>
        <p className="c-description pb-5 indent-4">
          We are currently working on a project called <b>League Funny</b>,
          which is a website that provides people to share some posts about any
          game they like. It is a full-stack project, and I am responsible for
          the NextJS frontend and some backend services. I am also responsible
          for the management of the project, including reviewing code, planning
          features, and testing.
        </p>
        <ul className="list-disc pl-5">
          <li className="mb-2">
            Reduce 50% of the development time by using Turborepo to manage more
            than one repository.
          </li>
          <li className="mb-2">
            Develop some useful hooks to reduce the development time. Such as
            useS3ImageUpload, useInfiniteScroll, etc.
          </li>
          <li className="mb-2">
            Lead other developers to learn and use the new technology, or the
            new feature of React.
          </li>
        </ul>
        <p className="c-description pb-5 indent-4">
          I am also learning other technologies, such as turborepo, sveltekit or
          kubernetes. I also have some experience and interest in open source
          projects. I have contributed to <b>nextjs.tw</b>, a website that
          provides the Chinese version of the NextJS documentation.
        </p>
        <p className="c-description pb-5 indent-4"></p>
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
