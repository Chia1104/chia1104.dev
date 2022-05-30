import {createAsyncThunk} from '@reduxjs/toolkit'
import {getAllRepos} from '@chia/api/github'

export const getAllReposAsync = createAsyncThunk(
    'github/getGithubData',
    async () => {
        return await getAllRepos('chia1104', 1, 6)
    }
)
