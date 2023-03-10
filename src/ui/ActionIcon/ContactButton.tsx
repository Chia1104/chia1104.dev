"use client";

import { type FC } from "react";
import { useAtom } from "jotai";
import { actionIconAtom } from "./store";

const ContactButton: FC = () => {
  const [{ isOpen }, handleActionSheet] = useAtom(actionIconAtom);

  return (
    <button
      className="group relative mb-10 inline-flex rounded transition ease-in-out hover:bg-secondary hover:dark:bg-primary"
      onClick={() => handleActionSheet({ isOpen: !isOpen })}>
      <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1">
        Contact me
      </span>
    </button>
  );
};

export default ContactButton;
