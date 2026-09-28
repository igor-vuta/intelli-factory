/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: `${__dirname}/..`,
  // Dev-only: hosts (e.g. a LAN IP) allowed to load /_next assets when testing on a phone.
  allowedDevOrigins: (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

module.exports = nextConfig;
