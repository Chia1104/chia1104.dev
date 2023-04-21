import { combineReducers } from "@reduxjs/toolkit";
import actionSheetReducer from "./action-sheet/index.ts";

const reducers = combineReducers({
  actionSheet: actionSheetReducer,
});

export default reducers;
