import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" data-scroll-behavior="smooth">
      <Head>
        {/* Prevent FOUC: apply stored theme class to <html> before any paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=location.pathname;var t=p==='/app/customer'?'modernLight':(p==='/app/factory')?'whatsappEmerald':'modernDark';try{var s=localStorage.getItem('if-theme');if(s)t=(s==='modernLight'||s==='whatsappEmerald')?s:'modernDark';}catch(e){}var m={modernLight:'theme-modern-light',modernDark:'theme-modern-dark',whatsappEmerald:'theme-whatsapp-emerald'};document.documentElement.classList.add(m[t]);})();`,
          }}
        />

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
        <meta name="theme-color" content="#0f1117" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
