import {createAsyncThunk} from '@reduxjs/toolkit'
import {getAllRepos} from '@chia/api/github'
import { createApi } from '@reduxjs/toolkit/query'
import { request, ClientError } from 'graphql-request'
import { GET_REPOS } from "@chia/GraphQL/github/query";
import { GITHUB_GRAPHQL_API } from "@chia/utils/constants";

export const getAllReposAsync = createAsyncThunk(
    'github/getGithubData',
    async () => {
        return await getAllRepos('chia1104', 1, 6)
    }
)

const graphqlBaseQuery =
    ({ baseUrl }: { baseUrl: string }) =>
        async ({ body }: { body: string }) => {
            try {
                const result = await request(baseUrl, body)
                return { data: result }
            } catch (error) {
                if (error instanceof ClientError) return { error: { status: error.response.status, data: error } }
                return { error: { status: 500, data: error } }
            }
        }

export const getAllReposApi = createApi({
    baseQuery: graphqlBaseQuery({
        baseUrl: GITHUB_GRAPHQL_API,
    }),
    endpoints: (build) => ({
        getAllRepos: build.query({
            query: () => ({
                body: GET_REPOS,
                variables: {
                    username: 'chia1104',
                    sort: 'PUSHED_AT',
                    limit: 6,
                    headers: {
                        accept: "application/vnd.github.v3+json",
                        authorization: `token ${process.env.NEXT_PUBLIC_GH_PUBLIC_TOKEN}`,
                    },
                }
            }),
            transformResponse: (response) => response.edges.node,
        }),
    }),
})
