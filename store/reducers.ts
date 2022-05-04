import {
    combineReducers,
} from "@reduxjs/toolkit";
import {exampleReducer} from "./modules/Example/reducers";

export const reducers = combineReducers({
    example: exampleReducer,
});
