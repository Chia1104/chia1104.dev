"use client";

import { useState } from "react";

import { Alert, Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useChangeLocale } from "@/hooks/use-change-locale";

interface Props {
  className?: string;
}

const FeedTranslationWarning = (props: Props) => {
  const t = useTranslations("blog");
  const tl = useTranslations("locale");
  const [visible, setVisible] = useState(true);
  const changeLocale = useChangeLocale();

  return (
    <Alert
      className={props.className}
      color="warning"
      title={"Warning"}
      description={t("not-translated", { locale: tl("zh-tw") })}
      onClose={() => setVisible(false)}
      isVisible={visible}
      endContent={
        <Button size="sm" onPress={() => changeLocale("zh-tw")}>
          {tl("zh-tw")}
        </Button>
      }
    />
  );
};

export default FeedTranslationWarning;
