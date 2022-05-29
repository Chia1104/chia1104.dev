import { createSlice } from '@reduxjs/toolkit';
import { youtubeInitState } from "@/store/modules/Youtube/state";
import { youtubeReducer } from "@/store/modules/Youtube/reducers";
import { AppState } from "@/src/store";
import { getAllVideosAsync } from "@/store/modules/Youtube/actions";

const youtubeSlice = createSlice({
    name: 'youtube',
    initialState: youtubeInitState,
    reducers: youtubeReducer,
    extraReducers: (builder) => {
        builder
            .addCase(getAllVideosAsync.pending, (state) => {
                state.allVideos.loading = 'pending'
            })
            .addCase(getAllVideosAsync.fulfilled, (state, action) => {
                state.allVideos.data = action.payload
                state.allVideos.loading = 'succeeded'
            })
            .addCase(getAllVideosAsync.rejected, (state, action) => {
                state.allVideos.error = action.error
                state.allVideos.loading = 'failed'
            })
    }
})

export const selectAllVideos = (state: AppState) => state.youtube.allVideos.data;
export const selectAllVideosLoading = (state: AppState) => state.youtube.allVideos.loading;
export const selectAllVideosError = (state: AppState) => state.youtube.allVideos.error;

export default youtubeSlice.reducer;
