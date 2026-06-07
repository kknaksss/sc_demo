/** @type {import('next').NextConfig} */
// SC-WP-01 C3 — frontend skeleton.
// standalone: Dockerfile 이 최소 런타임만 복사하도록 (node:20 멀티스테이지).
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
