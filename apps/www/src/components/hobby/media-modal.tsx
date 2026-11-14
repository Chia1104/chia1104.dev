"use client";

import type { ReactNode } from "react";

import { Modal } from "@heroui/react";

import { useRouter } from "@/libs/i18n/navigation";

/**
 * The sheet a work opens in over the list. It exists only while its route is the current one, so
 * closing it is going back.
 */
export const MediaModal = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const router = useRouter();
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) router.back();
      }}>
      <Modal.Container size="cover" scroll="inside">
        <Modal.Dialog aria-label={label} className="overflow-hidden p-0">
          <Modal.CloseTrigger className="bg-background/70 z-10" />
          {/* A size container, so the work's art can be as tall as the sheet whatever its margins. */}
          <Modal.Body className="[container-type:size] m-0 p-0">
            {children}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
