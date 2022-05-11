import NextHead from 'next/head'
import { FC } from "react";
import { Chia } from"../../../../../utils/meta/chia"

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
    const name = Chia.name
    const c_title = Chia.title
    const des = Chia.content
    return(
        <NextHead>
            <title>{ title || `${name} - ${c_title}` }</title>
            <meta name="description" content={ description || des } />
            <link rel="icon" href="/favicon.ico" />
        </NextHead>
    )
}

