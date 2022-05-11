import NextHead from 'next/head'
import { FC } from "react";

interface Props {
    title: string,
    description: string,
}

export const Head: FC<Props> = (
    {
        title,
        description,
    }
) => {
    return(
        <NextHead>
            <title>{ title || 'Chia1104 - Web Developer' }</title>
            <meta name="description" content={ description || 'Chia1104, 俞又嘉, WEB developer, UI/UX' } />
            <link rel="icon" href="/favicon.ico" />
        </NextHead>
    )
}

