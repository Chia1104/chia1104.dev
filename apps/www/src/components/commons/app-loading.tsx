"use client";

import { Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

import { TextPath } from "@chia/ui/text-path";
import { cn } from "@chia/ui/utils/cn.util";

interface Props {
  className?: string;
  title?: string;
  spinnerOnly?: boolean;
}

const AppLoading = (props: Props) => {
  const tMeta = useTranslations("meta");
  const tCommon = useTranslations("common");
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-3",
        props.className
      )}>
      {!props.spinnerOnly && (
        <span className="w-full max-w-[300px]">
          <TextPath
            text={props.title || tMeta("title")}
            svgProps={{
              viewBox: "0 0 320 100",
            }}
          />
        </span>
      )}
      <Spinner aria-label={tCommon("loading")} />
    </div>
  );
};

export default AppLoading;
