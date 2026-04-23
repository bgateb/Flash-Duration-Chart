import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  isAdmin?: boolean;
};

const password = process.env.SESSION_SECRET ?? "";

export const sessionOptions: SessionOptions = {
  password,
  cookieName: "flashduration_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

export async function getSession() {
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireAdmin(): Promise<boolean> {
  const s = await getSession();
  return Boolean(s.isAdmin);
}
