import mysql from "mysql2/promise";

declare global {
  var __mysqlPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
    throw new Error(
      "Missing MYSQL_HOST / MYSQL_USER / MYSQL_DATABASE env vars. Copy .env.local.example to .env.local and fill them in."
    );
  }
  return mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT ? Number(MYSQL_PORT) : 3306,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD ?? "",
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 8,
    namedPlaceholders: true,
    decimalNumbers: true,
    // Return DATE/DATETIME/TIMESTAMP columns as strings instead of JS Date
    // objects — matches our TypeScript types and avoids React error #31
    // when a Date is rendered directly in JSX.
    dateStrings: true,
  });
}

export function getPool(): mysql.Pool {
  if (globalThis.__mysqlPool) return globalThis.__mysqlPool;
  const pool = createPool();
  if (process.env.NODE_ENV !== "production") globalThis.__mysqlPool = pool;
  else globalThis.__mysqlPool = pool;
  return pool;
}
