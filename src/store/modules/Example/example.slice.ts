import { createSlice } from '@reduxjs/toolkit';
import { exampleInitState } from "./state";
import { exampleReducer } from "./reducers";
import {AppState} from "@/src/store";
import {getExampleDataAsync} from "@/store/modules/Example/actions";

const exampleSlice = createSlice({
    name: 'example',
    initialState: exampleInitState.example,
    reducers: exampleReducer,
    extraReducers: (builder) => {
        builder
            .addCase(getExampleDataAsync.pending, (state) => {
                state.loading = 'pending'
            })
            .addCase(getExampleDataAsync.fulfilled, (state, action) => {
                state.data = action.payload
                state.loading = 'succeeded'
            })
            .addCase(getExampleDataAsync.rejected, (state, action) => {
                state.error = action.error
                state.loading = 'failed'
            })
    },
});

// export const { beginRequestExampleData, succeedRequestExampleData, failRequestExampleData } = exampleSlice.actions;

export const selectExampleData = (state: AppState) => state.example.data;
export const selectExampleLoading = (state: AppState) => state.example.loading;
export const selectExampleError = (state: AppState) => state.example.error;

export default exampleSlice.reducer;
