import {createAsyncThunk} from '@reduxjs/toolkit'
import {getAllRepos} from '@chia/api/example'

export const getExampleDataAsync = createAsyncThunk(
    'example/getExampleData',
    async () => {
        return await getAllRepos('chia1104', 1)
    }
)
