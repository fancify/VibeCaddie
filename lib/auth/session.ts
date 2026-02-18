import { getServerSession } from "next-auth";
import { authOptions } from "./config";

/** 获取已认证的 session，未登录则抛出错误 */
export async function getRequiredSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

/** 获取当前登录用户的 ID */
export async function getUserId(): Promise<string> {
  const session = await getRequiredSession();
  return session.user.id;
}
