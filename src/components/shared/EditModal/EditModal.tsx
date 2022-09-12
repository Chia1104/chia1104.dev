import { type FC, type ReactNode } from "react";
import { Modal } from "@geist-ui/core";

interface Props {
  isOpen: boolean;
  activeModal: () => void;
  title?: string;
  subtitle?: string;
  onSubmit: () => void;
  children: ReactNode;
}

const EditModal: FC<Props> = (props) => {
  const { isOpen, activeModal, title, subtitle, onSubmit, children } = props;

  return (
    <Modal visible={isOpen} onClose={activeModal}>
      <Modal.Title>{title}</Modal.Title>
      <Modal.Subtitle>{subtitle}</Modal.Subtitle>
      <Modal.Content>{children}</Modal.Content>
      <Modal.Action passive onClick={activeModal}>
        Cancel
      </Modal.Action>
      <Modal.Action onClick={onSubmit}>Submit</Modal.Action>
    </Modal>
  );
};

export default EditModal;
