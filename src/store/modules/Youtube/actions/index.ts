import { createAsyncThunk } from "@reduxjs/toolkit";
import { getAllVideos } from "@chia/api/youtube";

export const getAllVideosAsync = createAsyncThunk(
  "youtube/getAllVideos",
  async ({}, { rejectWithValue }) => {
    try {
      return await getAllVideos(4);
    } catch (error) {
      console.error(error);
      return rejectWithValue(error);
    }
  }
);
