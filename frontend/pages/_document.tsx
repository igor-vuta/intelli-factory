import { Html, Head, Main, NextScript } from 'next/document';
import { COLOR_MODE_SCRIPT } from '../lib/colorMode';

export default function Document() {
  return (
    <Html lang="en" className="identity" data-scroll-behavior="smooth">
      <Head>
        {/* Before the mode script, so it can set the colour for light mode too */}
        <meta name="theme-color" content="#0E1214" />

        {/* Apply the light/dark preference of the new identity before first paint */}
        <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }} />

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

        {/* Theme */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
