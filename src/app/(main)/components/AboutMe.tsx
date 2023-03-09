import { Image } from "@chia/ui";
import type { FC } from "react";
import { Chia } from "@chia/shared/meta/chia";

interface Props {
  avatarSrc: string;
}

const AboutMe: FC<Props> = ({ avatarSrc }) => {
  const name = Chia.name;
  const chineseName = Chia.chineseName;
  const title = Chia.title;

  return (
    <div className="z-20 mt-10 flex flex-col justify-center px-3 md:flex-row">
      <div className="mb-5 flex flex-col items-center justify-end md:items-end md:pr-5">
        <h1 className="title text-sec-text dark:text-white">
          {name} {chineseName}
        </h1>
        <h2 className="description c-text-green-to-purple">
          {title.toUpperCase()}
        </h2>
      </div>
      <div className="flex h-[200px] w-[200px] items-center justify-center self-center overflow-hidden rounded-full bg-gradient-to-r from-purple-400 to-pink-600">
        <div className="c-bg-secondary h-[195px] w-[195px] rounded-full p-3">
          <Image
            src={avatarSrc || "/favicon.ico"}
            alt="Chia1104"
            width={195}
            height={195}
            priority
          />
        </div>
      </div>
    </div>
  );
};

export default AboutMe;
