"use client";

import { type FC } from "react";
import { useAppDispatch } from "@chia/hooks";
import { activeActionIconSheet } from "@chia/store/modules/ActionSheet/actionSheet.slice";

const ContactButton: FC = () => {
  const dispatch = useAppDispatch();

  return (
    <button
      className="mb-10 group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded"
      onClick={() => dispatch(activeActionIconSheet())}>
      <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1">
        Contact me
      </span>
    </button>
  );
};

export default ContactButton;
