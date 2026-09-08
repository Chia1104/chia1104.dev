"use client";

import { Button, Label, Modal, ProgressBar, Spinner } from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";

import { useAgentUsage, usageFractionOf } from "@chia/agent-elements/usage";

import { client } from "@/libs/orpc/client";

interface UsageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UsageDialog = ({ isOpen, onOpenChange }: UsageDialogProps) => {
  const t = useTranslations("chbot.usageDialog");
  const format = useFormatter();
  const usage = useAgentUsage(client.agent);
  const standing = usage.data;
  const percent = standing
    ? Math.round((usageFractionOf(standing) ?? 0) * 100)
    : 0;

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" scroll="inside">
          <Modal.Dialog className="gap-3 p-4 sm:max-w-[380px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p className="text-muted text-sm">{t("description")}</p>
              {usage.isPending ? (
                <div
                  role="status"
                  className="text-muted flex items-center gap-2 py-4 text-sm">
                  <Spinner size="sm" />
                  {t("loading")}
                </div>
              ) : usage.isError ? (
                <div className="flex flex-col items-start gap-3">
                  <p role="alert" className="text-danger text-sm">
                    {t("failed")}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => void usage.refetch()}>
                    {t("retry")}
                  </Button>
                </div>
              ) : standing ? (
                <>
                  {standing.limitMicros === null ? (
                    <div className="py-2">
                      <p className="text-xl font-medium">{t("unlimited")}</p>
                      <p className="text-muted mt-2 text-sm">
                        {t("unlimitedDescription")}
                      </p>
                    </div>
                  ) : standing.limitMicros <= 0 ? (
                    <p className="text-sm">{t("noAllowance")}</p>
                  ) : (
                    <ProgressBar
                      value={percent}
                      color={percent >= 100 ? "danger" : "accent"}>
                      <Label className="text-sm">{t("weekly")}</Label>
                      <ProgressBar.Output className="font-mono text-sm" />
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  )}
                  {standing.limitMicros !== null && (
                    <p className="text-muted text-xs">
                      {t("reset", {
                        time: format.dateTime(new Date(standing.period.end), {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                        }),
                      })}
                    </p>
                  )}
                  <p className="border-border/60 text-muted border-t pt-3 text-xs leading-relaxed">
                    {t("ownKey")}
                  </p>
                </>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" size="sm">
                {t("done")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
