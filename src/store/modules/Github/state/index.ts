interface IAllReposState {
    data: object;
    loading: 'idle' | 'pending' | 'succeeded' | 'failed';
    error: any;
}

export const githubInitState = {
    allRepos: {
        data: [],
        loading: 'idle',
        error: null,
    } as IAllReposState,
}
