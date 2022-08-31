import { combineReducers } from "@reduxjs/toolkit";
import actionSheetReducer from "./modules/ActionSheet/actionSheet.slice";

export const reducers = combineReducers({
  actionSheet: actionSheetReducer,
});
