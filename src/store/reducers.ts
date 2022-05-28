import {
    combineReducers,
} from "@reduxjs/toolkit";
import exampleReducer from "./modules/Example/example.slice";
import actionSheetReducer from "./modules/ActionSheet/actionSheet.slice";
import githubReducer from "./modules/Github/github.slice";

export const reducers = combineReducers({
    example: exampleReducer,
    actionSheet: actionSheetReducer,
    github: githubReducer,
});
