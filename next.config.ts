import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer', 'cheerio', 'googleapis'],
};

export default nextConfig;
