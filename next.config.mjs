/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["bcryptjs", "exceljs", "pdfmake"],
  },
};

export default nextConfig;
