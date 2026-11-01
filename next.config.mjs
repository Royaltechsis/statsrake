/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const nextConfig = { turbopack: { root }, output: 'export', trailingSlash: true, images: { unoptimized: true }, reactStrictMode: true };
export default nextConfig;
