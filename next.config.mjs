/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ESLint is checked separately in CI / package.json script
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
