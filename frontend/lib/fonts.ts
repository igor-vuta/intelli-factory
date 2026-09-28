import localFont from 'next/font/local';

// IBM Plex ships with the app (Fontsource's files), so builds never fetch fonts from the network.
// Each script subset is its own face with Fontsource's unicode-range, so a page downloads only
// the subsets its text uses: Latin for English, Cyrillic (+ extended, for Kazakh) for Russian and
// Kazakh. Only the last face in each stack carries next/font's size-matched fallback; earlier,
// the fallback would draw Cyrillic before Plex's own Cyrillic face was tried.
const sansLatin = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2',
      weight: '500',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2',
      weight: '600',
    },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
  adjustFontFallback: false,
});
const sansLatinExt = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-500-normal.woff2',
      weight: '500',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-600-normal.woff2',
      weight: '600',
    },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
  preload: false,
  adjustFontFallback: false,
});
const sansCyrillic = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-500-normal.woff2',
      weight: '500',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-600-normal.woff2',
      weight: '600',
    },
  ],
  display: 'swap',
  declarations: [
    { prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  ],
  preload: false,
  adjustFontFallback: false,
});
const sansCyrillicExt = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-ext-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-ext-500-normal.woff2',
      weight: '500',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-ext-600-normal.woff2',
      weight: '600',
    },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
    },
  ],
  preload: false,
});

const monoLatin = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
      weight: '500',
    },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
  adjustFontFallback: false,
});
const monoCyrillic = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-500-normal.woff2',
      weight: '500',
    },
  ],
  display: 'swap',
  declarations: [
    { prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  ],
  preload: false,
  adjustFontFallback: false,
});
const monoCyrillicExt = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-ext-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-ext-500-normal.woff2',
      weight: '500',
    },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
    },
  ],
  preload: false,
  fallback: ['ui-monospace', 'monospace'],
});

const stack = (...faces: { style: { fontFamily: string } }[]) =>
  faces.map((face) => face.style.fontFamily).join(', ');

/** Font-family stacks for the identity tokens (`--if-font`, `--if-font-mono`). */
export const plexSans = stack(sansLatin, sansLatinExt, sansCyrillic, sansCyrillicExt);
export const plexMono = stack(monoLatin, monoCyrillic, monoCyrillicExt);
