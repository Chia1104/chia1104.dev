export type Youtube = {
    items: Array<YoutubeItem>;
}

export type YoutubeItem = {
    id: string;
    snippet: {
        publishedAt: string,
        channelId: string,
        title: string,
        description: string,
        thumbnails: {
            default: {
                url: string,
                width: number,
                height: number
            },
            medium: {
                url: string,
                width: number,
                height: number
            },
            high: {
                url: string,
                width: number,
                height: number
            },
            standard: {
                url: string,
                width: number,
                height: number,
            },
            maxres: {
                url: string,
                width: number,
                height: number,
            }
        },
        channelTitle: string,
        playlistId: string,
        position: number,
        resourceId: {
            kind: string,
            videoId: string
        },
        videoOwnerChannelTitle: string,
        videoOwnerChannelId: string,
    }
}
