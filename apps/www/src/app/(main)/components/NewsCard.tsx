import { type FC } from "react";
import Link from "next/link";
import { type UrlObject } from "url";

interface Props {
  title: string;
  content: string;
  subtitle?: string;
  link: string | UrlObject | any;
}

const NewsCard: FC<Props> = ({ title, content, subtitle, link }) => {
  return (
    <div className="flex flex-col items-center justify-center">
      <header className="subtitle c-text-secondary truncate">{title}</header>
      <div className="c-bg-gradient-yellow-to-pink relative mt-5 flex h-[170px] w-[310px] items-center justify-center rounded-xl lg:mx-5">
        <div className="c-bg-secondary flex h-[163px] w-[303px] flex-col rounded-xl p-2">
          <p className="line-clamp-3 text-center text-lg">{content}</p>
          <p className="c-text-secondary c-description mb-5 mt-auto line-clamp-1 pl-1 text-left text-base">
            {subtitle}
          </p>
        </div>
        <Link
          scroll
          href={link}
          className="c-bg-gradient-green-to-purple absolute top-[9rem] flex h-10 w-[85px] items-center justify-center rounded-full text-white transition ease-in-out hover:scale-[1.05]">
          MORE
        </Link>
      </div>
    </div>
  );
};

export default NewsCard;
