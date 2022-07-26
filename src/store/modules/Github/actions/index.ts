import { createAsyncThunk } from "@reduxjs/toolkit";
import githubGraphQLClient from "@chia/GraphQL/github/github.client";
import { GET_REPOS } from "@chia/GraphQL/github/query";
import { RepoGql } from "@chia/utils/types/repo";

export const getAllReposAsync = createAsyncThunk(
  "github/getGithubData",
  async ({}, { rejectWithValue }) => {
    try {
      const { user } = await githubGraphQLClient.request(GET_REPOS, {
        username: "chia1104",
        sort: "PUSHED_AT",
        limit: 6,
      });
      console.log(user);
      return user.repositories.edges as RepoGql[];
    } catch (error) {
      console.error(error);
      return rejectWithValue(error);
    }
  }
);
