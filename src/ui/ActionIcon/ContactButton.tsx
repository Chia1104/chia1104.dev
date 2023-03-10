"use client";

import { type FC } from "react";
import { useAppDispatch } from "@chia/hooks";
import { activeActionIconSheet } from "@chia/store/reducers/action-sheet";

const ContactButton: FC = () => {
  const dispatch = useAppDispatch();

  return (
    <button
      className="group relative mb-10 inline-flex rounded transition ease-in-out hover:bg-secondary hover:dark:bg-primary"
      onClick={() => dispatch(activeActionIconSheet())}>
      <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1">
        Contact me
      </span>
    </button>
  );
};

export default ContactButton;
