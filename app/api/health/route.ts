import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";

/** GET /api/health — 诊断端点 */
export async function GET() {
  const checks: Record<string, string> = {};

  // 1. 环境变量检查
  checks.skip_auth = process.env.SKIP_AUTH ?? "NOT_SET";
  checks.database_url = process.env.DATABASE_URL ? "SET" : "NOT_SET";
  checks.node_env = process.env.NODE_ENV ?? "NOT_SET";

  // 2. 数据库连接检查
  try {
    const result = await query<{ now: string }>("SELECT now()::text AS now");
    checks.db_connection = "OK";
    checks.db_time = result.rows[0]?.now ?? "?";
  } catch (err) {
    checks.db_connection = "FAILED";
    checks.db_error = (err as Error).message;
  }

  const allOk = checks.db_connection === "OK" && checks.database_url === "SET";

  return NextResponse.json(checks, { status: allOk ? 200 : 500 });
}
