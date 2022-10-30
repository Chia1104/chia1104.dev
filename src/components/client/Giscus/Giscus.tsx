"use client";

import type { GiscusProps } from "@giscus/react";
import { giscusConfig } from "@chia/config/giscus.config";
import { useIsMounted, useDarkMode } from "@chia/hooks";
import G from "@giscus/react";
import { FC } from "react";

interface Props {
  title: string;
}

const Giscus: FC<Props> = (props) => {
  const { title } = props;
  const isDarkMode = useDarkMode();

  return (
    <G
      {...(giscusConfig as GiscusProps)}
      term={title}
      mapping="specific"
      reactionsEnabled="1"
      emitMetadata="0"
      theme={isDarkMode ? "dark" : "light"}
    />
  );
};

export default Giscus;
