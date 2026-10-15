import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The Docker image (Dockerfile) runs .next/standalone/server.js on Cloud Run.
  output: 'standalone',
  // resvg is a native package; Next's default external list does not include it. The Cloud Trace
  // exporter (gRPC and Google auth underneath) loads from node_modules as published, not bundled.
  serverExternalPackages: ['@resvg/resvg-js', '@google-cloud/opentelemetry-cloud-trace-exporter'],
  // The layout engine reads the brand and Noto fonts, the art library and the demo covers from
  // disk at runtime, by paths relative to process.cwd(); standalone copies them to the same paths.
  // Only the /admin pages, routes and actions render slides: /posts and /feed serve stored PNGs.
  outputFileTracingIncludes: {
    '/admin/**': [
      './src/features/content/assets/**/*',
      './src/features/content/demo-sources/covers/**/*',
    ],
  },
  experimental: {
    // Long pasted sources go through a server action; the default limit is 1 MB. A page's
    // reference image (criterion 105) is up to 5 MB and goes one per request, so 6 MB covers it
    // with its form fields; the action reads a file's bytes only when it is 5 MB or less.
    serverActions: { bodySizeLimit: '6mb' },
  },
  // Development only: another device on the local network (a phone at http://192.168.x.y:3000)
  // may load the dev server's own assets; without this Next blocks them, the page's JavaScript
  // never arrives, and the splash can never hand over. Production ignores it.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  // Retired student paths, permanently (308) to their /onboarding screens (PRODUCT.md). A query
  // passes through; /onboarding/facts resumes at her first unanswered question and drops it.
  async redirects() {
    return [
      { source: '/picture', destination: '/onboarding/character', permanent: true },
      { source: '/opening/facts', destination: '/onboarding/facts', permanent: true },
      {
        source: '/opening/:step(study|living|after)',
        destination: '/onboarding/:step',
        permanent: true,
      },
      { source: '/attention', destination: '/onboarding/attention', permanent: true },
    ]
  },
}

export default nextConfig
