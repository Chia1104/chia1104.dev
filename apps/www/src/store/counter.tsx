"use client";

import { create } from "zustand";

export interface BearState {
  bears: number;
  increase: (by: number) => void;
}

export const useCounter = create<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
}));

export const Counter = () => {
  const counter = useCounter((state) => state.bears);

  return <>{counter}</>;
};

export const AddCount = () => {
  const increase = useCounter((state) => state.increase);

  return <button onClick={() => increase(1)}>Add</button>;
};
