import {createAsyncThunk} from '@reduxjs/toolkit'
import {getAllRepos} from '@/api/github'

export const getAllReposAsync = createAsyncThunk(
    'github/getGithubData',
    async () => {
        return await getAllRepos('chia1104', 1, 6)
    }
)
