import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Standard favicons */}
        <link rel="icon" type="image/x-icon" href="/favicon/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon/favicon-96x96.png" />

        {/* Apple */}
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />

        {/* Safari pinned tab */}
        <link rel="mask-icon" href="/favicon/favicon.svg" color="#f97316" />

        {/* PWA manifest */}
        <link rel="manifest" href="/favicon/site.webmanifest" />

        {/* Windows */}
        <meta name="msapplication-TileColor" content="#f97316" />
        <meta name="msapplication-config" content="/favicon/browserconfig.xml" />

        {/* Theme */}
        <meta name="theme-color" content="#0f1117" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
