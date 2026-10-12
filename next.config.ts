import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
      // The futures are parked until their own design: old links resume onboarding.
      { source: '/futures', destination: '/onboarding', permanent: true },
    ]
  },
}

export default nextConfig
