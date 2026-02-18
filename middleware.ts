import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/** 保护 /(app)/ 路由组：未认证用户重定向到 /login */
export default async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(app)/:path*"],
};
