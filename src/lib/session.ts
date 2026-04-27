import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "./session-config";

export type { SessionData } from "./session-config";
export { sessionOptions } from "./session-config";

export async function getSession() {
  const password = sessionOptions.password as string;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireAdmin(): Promise<boolean> {
  const s = await getSession();
  return Boolean(s.isAdmin);
}
