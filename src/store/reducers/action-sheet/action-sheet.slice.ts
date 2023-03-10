import { createSlice } from "@reduxjs/toolkit";
import actionSheetInitState from "./action-sheet.state";
import actionSheetReducer from "./action-sheet.reducer";
import type { AppState } from "../../type";

const actionSheetSlice = createSlice({
  name: "actionSheet",
  initialState: actionSheetInitState,
  reducers: actionSheetReducer,
});

export const { activeActionIconSheet } = actionSheetSlice.actions;

export const selectActionIconSheet = (state: AppState) =>
  state.actionSheet.actionIconSheet.isOpen;

export default actionSheetSlice.reducer;
