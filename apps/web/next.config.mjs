/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Some wallet-adapter deps reference optional native modules.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

export default nextConfig;
