import {
    combineReducers,
} from "@reduxjs/toolkit";
import exampleReducer from "./modules/Example/example.slice";

export const reducers = combineReducers({
    example: exampleReducer,
});
