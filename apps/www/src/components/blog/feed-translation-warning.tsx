"use client";

import { useState } from "react";

import { Alert, Button } from "@nextui-org/react";
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
      type="warning"
      color="warning"
      title={t("not-translated", { locale: tl("zh-tw") })}
      onClose={() => setVisible(false)}
      visible={visible}
      endContent={
        <Button size="sm" onPress={() => changeLocale("zh-tw")}>
          {tl("zh-tw")}
        </Button>
      }
    />
  );
};

export default FeedTranslationWarning;
