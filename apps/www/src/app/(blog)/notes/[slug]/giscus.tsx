"use client";

import type { FC } from "react";

import G from "@giscus/react";

import { useTheme } from "@chia/ui";

import { giscusConfig } from "@/config/giscus.config";

interface Props {
  title: string;
}

const Giscus: FC<Props> = (props) => {
  const { title } = props;
  const { isDarkMode } = useTheme();

  return (
    <G
      {...giscusConfig}
      term={title}
      mapping="specific"
      reactionsEnabled="1"
      emitMetadata="0"
      theme={isDarkMode ? "dark" : "light"}
    />
  );
};

export default Giscus;
