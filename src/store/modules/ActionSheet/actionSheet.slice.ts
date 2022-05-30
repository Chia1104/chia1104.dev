import { createSlice } from '@reduxjs/toolkit';
import { actionSheetInitState } from "@chia/store/modules/ActionSheet/state";
import { actionSheetReducer } from "@chia/store/modules/ActionSheet/reducers";
import type { AppState } from "@chia/src/store";

const actionSheetSlice = createSlice({
    name: 'actionSheet',
    initialState: actionSheetInitState,
    reducers: actionSheetReducer,
});

export const { activeActionIconSheet } = actionSheetSlice.actions;

export const selectActionIconSheet = (state: AppState) => state.actionSheet.actionIconSheet.isOpen;

export default actionSheetSlice.reducer;
