"use client";

import { useState } from "react";

import { Alert, Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useChangeLocale } from "@/hooks/use-change-locale";
import { Locale } from "@/libs/utils/i18n";

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
      title={t("warning")}
      description={t("not-translated", { locale: tl(Locale.ZH_TW) })}
      onClose={() => setVisible(false)}
      isVisible={visible}
      endContent={
        <Button size="sm" onPress={() => changeLocale(Locale.ZH_TW)}>
          {tl(Locale.ZH_TW)}
        </Button>
      }
    />
  );
};

export default FeedTranslationWarning;
