interface State {
    data: object;
    loading: 'idle' | 'pending' | 'succeeded' | 'failed';
    error: any;
}

export const youtubeInitState = {
    allVideos: {
        data: [],
        loading: 'idle',
        error: null,
    } as State,
}
