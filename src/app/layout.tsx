// eslint-disable-next-line @next/next/no-document-import-in-page
import { Html, Head, Main, NextScript } from "next/document";

const Document = () => {
  return (
    <Html lang="zh-Hant-TW">
      <Head />
      <body className="c-bg-primary scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};

export default Document;
