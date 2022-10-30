import { type FC } from "react";
import { Chia } from "@chia/shared/meta/chia";
import NextHead from "next/head";

interface Props {
  title: string;
  description: string;
  canonicalUrl?: string;
  keywords?: string[];
  type?: "website" | "article" | "book" | "profile";
  imageUrl?: string;
}

const Head: FC<Props> = (props) => {
  const {
    title,
    description,
    canonicalUrl,
    keywords,
    type = "website",
    imageUrl,
  } = props;
  const name = Chia.name;
  const c_title = Chia.title;
  const des = Chia.content;
  const chinese_name = Chia.chineseName;
  return (
    <NextHead>
      <title>{title || `${name} / ${chinese_name} - ${c_title}`}</title>
      <meta
        property="og:title"
        content={title || `${name} / ${chinese_name} - ${c_title}`}
        key="title"
      />
      <meta name="robots" content="index,follow" />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      <meta name="description" content={description || des} />
      <meta
        property="og:description"
        content={description || des}
        key="description"
      />
      <meta
        name="keywords"
        content={
          keywords?.join(", ") ||
          "Typescript, FullStack, NextJS, React, NestJS, Chia1104"
        }
      />
      <meta name="author" content={`${name} ${chinese_name}`} />
      <meta property="og:type" content={type} key="type" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="icon" href="/favicon.ico" />
      <meta name="theme-color" content="#2B2E4A" />
      <meta property="og:image" content={imageUrl || ""} key="image" />
    </NextHead>
  );
};

export default Head;
