import { FC } from "react";
import Head from 'next/head'

export const Header: FC = () => {
    return(
        <Head>
            <title>Chia WEB</title>
            <meta name="description" content="Yu Yu, Chia, 俞又嘉, WEB developer, UI/UX " />
            <link rel="icon" href="/favicon.ico" />
        </Head>
    )
}

