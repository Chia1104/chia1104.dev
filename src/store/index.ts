import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import { reducers } from "./reducers";

export const store = configureStore({
  reducer: reducers,
  devTools: process.env.NODE_ENV !== "production",
});

export type AppState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  AppState,
  unknown,
  Action<string>
>;

export const newStore = {
  state: {
    isActionSheetOpen: false,
  },
  setState: (fnOrState: any) => {
    const newState =
      typeof fnOrState === "function" ? fnOrState(newStore.state) : fnOrState;
    newStore.state = { ...newStore.state, ...newState };
    newState.listeners.forEach((listener: any) => listener(newStore.state));
  },
  listeners: new Set(),
  subscribe: (callback: any) => {
    newStore.listeners.add(callback);
    return () => newStore.listeners.delete(callback);
  },
  getSnapshot: () => newStore.state,
};
