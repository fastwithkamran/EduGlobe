import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // eslint is configured via eslint.config.mjs (removed from NextConfig in Next.js 16)
  typescript: {
    // Set to true to prevent TS type errors from blocking Vercel builds
    ignoreBuildErrors: true,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      { protocol: 'https', hostname: 'res.cloudinary.com' },    // Cloudinary images
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google profile photos
    ],
  },
  transpilePackages: ['motion'],
  // Next.js 16 enables Turbopack by default. An empty turbopack config is
  // required to avoid a build error when a webpack config is also present.
  turbopack: {},
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
