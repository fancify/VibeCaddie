import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 将 build 时的环境变量传入 SSR runtime（Amplify WEB_COMPUTE 需要）
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    SKIP_AUTH: process.env.SKIP_AUTH,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
};

export default nextConfig;
