import {createAsyncThunk} from '@reduxjs/toolkit'
import {getAllRepos} from '@/api/example'

export const getAllReposAsync = createAsyncThunk(
    'example/getAllRepos',
    async () => {
        return await getAllRepos('chia1104', 1)
    }
)
