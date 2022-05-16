import { createSlice } from '@reduxjs/toolkit';
import { exampleInitState } from "./state";
import { exampleReducer } from "./reducers";
import {getAllReposAsync} from "@/store/modules/Example/actions";

const exampleSlice = createSlice({
    name: 'example',
    initialState: exampleInitState,
    reducers: exampleReducer,
    extraReducers: (builder) => {
        builder
            .addCase(getAllReposAsync.pending, (state) => {
                state.example.isLoading = true
            })
            // .addCase(getAllReposAsync.fulfilled, (state, action) => {
            //     state.example.isLoading = false
            //     state.example.data = [...state.example.data, ...action.payload]
            // })
    },
});

export const exampleActions = exampleSlice.actions;

export default exampleSlice.reducer;
