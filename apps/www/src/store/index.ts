import { configureStore } from "@reduxjs/toolkit";
import reducers from "./reducers/index.ts";

export const store = configureStore({
  reducer: reducers,
  devTools: process.env.NODE_ENV !== "production",
});
