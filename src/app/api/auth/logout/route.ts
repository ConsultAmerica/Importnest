import { NextResponse } from "next/server";
import { LOCAL_SESSION_COOKIE } from "@/lib/local-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
