"use client";

import { giscusConfig } from "@/config/giscus.config";
import { useTheme } from "@chia/ui";
import G from "@giscus/react";
import type { FC } from "react";

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
