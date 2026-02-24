import { Pool, QueryResult } from 'pg';

// Amplify Lambda + RDS：需要 SSL 但不验证自签名证书
// 从 URL 中去掉 sslmode 参数，由 Pool config 显式控制
const dbUrl = (process.env.DATABASE_URL ?? '').replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T extends Record<string, any> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default pool;
