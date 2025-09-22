/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    appDir: false
  },
  api: {
    bodyParser: {
      sizeLimit: "50mb"
    }
  }
}

export default nextConfig;
