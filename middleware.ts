import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/** 保护 /(app)/ 路由组：未认证用户重定向到 /login */
export default async function middleware(req: NextRequest) {
  // TODO: 恢复 auth guard（临时关闭用于预览）
  if (process.env.SKIP_AUTH === "true") {
    return NextResponse.next();
  }

  const token = await getToken({ req });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/courses/:path*",
    "/rounds/:path*",
    "/briefing/:path*",
    "/chat/:path*",
  ],
};
