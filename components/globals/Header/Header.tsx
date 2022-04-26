import Head from 'next/head'

export const Header = (
    {
        title,
        description,
    }:
    {
        title: string,
        description: string,
    }
) => {
    return(
        <Head>
            <title>{ title || 'Chia WEB' }</title>
            <meta name="description" content={ description || 'Yu Yu, Chia, 俞又嘉, WEB developer, UI/UX' } />
            <link rel="icon" href="/public/favicon.ico" />
        </Head>
    )
}

