"use client";

import { SessionProvider } from "next-auth/react";

/** 客户端 SessionProvider 包装组件 */
export default function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
