"use client";

import { Button, Modal } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  isPending: boolean;
  targetName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal = ({
  isOpen,
  isPending,
  targetName,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) => {
  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={() => onCancel()}>
        <Modal.Container placement="auto">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Delete File</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex items-start gap-3 rounded-lg bg-red-500/10 p-3">
                <AlertTriangle className="text-danger mt-0.5 size-5 shrink-0" />
                <p className="text-sm">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold">{targetName}</span>? This
                  action cannot be undone.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onCancel} isPending={isPending}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={onConfirm}
                isPending={isPending}>
                Delete
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
