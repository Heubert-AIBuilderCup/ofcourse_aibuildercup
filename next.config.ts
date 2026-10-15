import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
