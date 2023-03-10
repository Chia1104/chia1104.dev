import { atom } from "jotai";

export const actionIconAtom = atom({
  isOpen: false,
});

export const isOpenAtom = atom((get) => get(actionIconAtom).isOpen);
