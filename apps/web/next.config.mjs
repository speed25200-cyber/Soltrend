/** @type {import('next').NextConfig} */
const isExport = process.env.STATIC_EXPORT === 'true';
const basePath = process.env.BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  // Static export for GitHub Pages (STATIC_EXPORT=true). Left off for normal
  // SSR builds / dev so nothing changes locally.
  ...(isExport ? { output: 'export', trailingSlash: true } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  webpack: (config) => {
    // Some wallet-adapter deps reference optional native modules.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

export default nextConfig;
