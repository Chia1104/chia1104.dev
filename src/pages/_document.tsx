import React from 'react'
import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
    render() {
        return (
            <Html lang="zh">
                <Head />
                <body className="bg-[#dddddd] dark:bg-black dark:text-white text-black transition ease-in-out">
                    <Main />
                    <NextScript />
                </body>
            </Html>
        )
    }
}

export default MyDocument
