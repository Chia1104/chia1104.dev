import { createSlice } from '@reduxjs/toolkit';
import { actionSheetInitState } from "@/store/modules/ActionSheet/state";
import { actionSheetReducer } from "@/store/modules/ActionSheet/reducers";
import type { AppState } from "@/src/store";

const actionSheetSlice = createSlice({
    name: 'actionSheet',
    initialState: actionSheetInitState,
    reducers: actionSheetReducer,
});

export const { activeActionIconSheet } = actionSheetSlice.actions;

export const selectActionIconSheet = (state: AppState) => state.actionSheet.actionIconSheet.isOpen;

export default actionSheetSlice.reducer;
