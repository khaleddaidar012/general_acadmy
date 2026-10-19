/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  outputFileTracingRoot: __dirname,
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
  },
}

module.exports = nextConfig

if (process.env.ACADEMY_USE_D1 === '1' && process.env.NODE_ENV === 'development') {
  require('@opennextjs/cloudflare').initOpenNextCloudflareForDev(
    process.env.ACADEMY_D1_PERSIST_PATH ? { persist: { path: process.env.ACADEMY_D1_PERSIST_PATH } } : undefined
  )
}
