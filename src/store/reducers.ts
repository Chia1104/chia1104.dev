import { combineReducers } from "@reduxjs/toolkit";
import actionSheetReducer from "./modules/ActionSheet/actionSheet.slice";
import githubReducer from "./modules/Github/github.slice";
import youtubeReducer from "./modules/Youtube/youtube.slice";

export const reducers = combineReducers({
  actionSheet: actionSheetReducer,
  github: githubReducer,
  youtube: youtubeReducer,
});
