import { createSlice } from '@reduxjs/toolkit';
import { githubInitState } from "@chia/store/modules/Github/state";
import { githubReducer } from "@chia/store/modules/Github/reducers";
import { type AppState } from "@chia/store";
import { getAllReposAsync } from "@chia/store/modules/Github/actions";

const githubSlice = createSlice({
    name: 'github',
    initialState: githubInitState,
    reducers: githubReducer,
    extraReducers: (builder) => {
        builder
            .addCase(getAllReposAsync.pending, (state) => {
                state.allRepos.loading = 'pending'
            })
            .addCase(getAllReposAsync.fulfilled, (state, action) => {
                state.allRepos.data = action.payload
                state.allRepos.loading = 'succeeded'
            })
            .addCase(getAllReposAsync.rejected, (state, action) => {
                state.allRepos.error = action.error
                state.allRepos.loading = 'failed'
            })
    }
})

export const selectAllRepos = (state: AppState) => state.github.allRepos.data;
export const selectAllReposLoading = (state: AppState) => state.github.allRepos.loading;
export const selectAllReposError = (state: AppState) => state.github.allRepos.error;

export default githubSlice.reducer;
