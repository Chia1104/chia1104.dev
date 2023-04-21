import { combineReducers } from "@reduxjs/toolkit";
import actionSheetReducer from "./action-sheet";

const reducers = combineReducers({
  actionSheet: actionSheetReducer,
});

export default reducers;
