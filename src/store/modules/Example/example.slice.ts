import { createSlice } from '@reduxjs/toolkit';
import { exampleInitState } from "./state";
import { exampleReducer } from "./reducers";

const exampleSlice = createSlice({
    name: 'example',
    initialState: exampleInitState,
    reducers: exampleReducer,
});

export const { beginRequestExampleData, successRequestExampleData, failureRequestExampleData } = exampleSlice.actions;

export default exampleSlice.reducer;
