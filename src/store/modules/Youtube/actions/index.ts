import {createAsyncThunk} from '@reduxjs/toolkit'
import { getAllVideos } from "@/api/youtube";

export const getAllVideosAsync = createAsyncThunk(
    'youtube/getAllVideos',
    async () => {
        return await getAllVideos(6)
    }
)
