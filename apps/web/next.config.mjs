import { createRequire } from 'node:module';

// The config is an ES module, so there is no bare `require` to resolve the
// polyfill packages with.
const require = createRequire(import.meta.url);

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
  webpack: (config, { webpack }) => {
    // Some wallet-adapter deps reference optional native modules.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      // @solana/web3.js and the wallet adapters assume Node's Buffer/process
      // exist. The browser has neither, so without these every instruction we
      // build throws "Buffer is not defined" the moment a user tries to stake,
      // claim or buy — the wallet connects and then nothing works.
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser'),
      crypto: false,
      stream: false,
    };
    config.plugins.push(
      new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'], process: 'process/browser' }),
    );
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

export default nextConfig;
