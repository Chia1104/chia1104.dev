import {
    combineReducers,
} from "@reduxjs/toolkit";
import exampleReducer from "./modules/Example/exampleSlice";

export const reducers = combineReducers({
    example: exampleReducer,
});
