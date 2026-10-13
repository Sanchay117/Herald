import path from 'node:path'
import type { NextConfig } from 'next'

const workspaceRoot = path.join(__dirname, '../..')

const nextConfig: NextConfig = {
  // ring-kit ships TypeScript source from the workspace.
  transpilePackages: ['ring-kit'],
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
}

export default nextConfig
