/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma roda apenas no servidor; evita bundling no edge.
  serverExternalPackages: ["@prisma/client", "prisma", "xlsx"],
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default nextConfig;
