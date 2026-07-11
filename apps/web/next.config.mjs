/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.150.223"],
  transpilePackages: ["@opentrust/core"]
};

export default nextConfig;
