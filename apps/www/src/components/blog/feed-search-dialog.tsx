"use client";

import { useState } from "react";

import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { CommandDialog, CommandInput, CommandList } from "@chia/ui/cmd";

import { FeedSearch } from "@/components/commons/feed-search";

interface FeedSearchDialogProps {
  locale: PropsWithLocale["locale"];
}

export function FeedSearchDialog({ locale }: FeedSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const t = useTranslations("nav");

  const close = () => {
    setQuery("");
    setOpen(false);
  };

  return (
    <>
      <Button
        fullWidth
        variant="tertiary"
        aria-label={t("search-articles")}
        className="not-prose dark:bg-dark-dark rounded-full"
        onPress={() => setOpen(true)}>
        <span className="i-mdi-search size-3.5" />
        <span className="hidden sm:inline">{t("search-articles")}</span>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setQuery("");
          }
        }}
        commandProps={{ shouldFilter: false }}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("search-placeholder")}
        />
        <CommandList>
          {query.trim().length >= 2 ? (
            <FeedSearch query={query} locale={locale} onSelect={close} />
          ) : (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              {t("search-hint")}
            </p>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
