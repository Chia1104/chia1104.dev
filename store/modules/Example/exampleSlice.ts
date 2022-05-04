import { createSlice } from '@reduxjs/toolkit';
import { exampleInitState } from "./state";
import { exampleReducer } from "./reducers";

export const exampleSlice = createSlice({
  name: 'example',
  initialState: exampleInitState,
  reducers: { exampleReducer },
});
