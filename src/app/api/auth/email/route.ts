import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  LOCAL_SESSION_COOKIE,
  hashPassword,
  signSession,
  verifyPassword,
} from "@/lib/local-auth";

export async function POST(request: Request) {
  let body: { email?: string; password?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter an email and password." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const mode = body.mode === "sign-up" ? "sign-up" : "sign-in";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  try {
    return await authenticate(email, password, mode);
  } catch (err) {
    // DB outage must surface as a readable message, not an empty 500 the form can't parse.
    console.error("[auth/email] failed", err);
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again in a moment." },
      { status: 503 },
    );
  }
}

async function authenticate(email: string, password: string, mode: "sign-in" | "sign-up") {
  const existing = await prisma.appUser.findUnique({ where: { email } });

  if (mode === "sign-up") {
    if (existing?.passwordHash) {
      return NextResponse.json(
        { error: "An account with that email already exists. Sign in instead." },
        { status: 409 },
      );
    }
    if (existing) {
      // Row created by Google sign-in: setting a password here would let anyone
      // who knows the address take the account over without proving ownership.
      return NextResponse.json(
        { error: "That email is linked to Google sign-in. Use Continue with Google instead." },
        { status: 409 },
      );
    }
    const user = await prisma.appUser.create({
      data: { email, passwordHash: hashPassword(password), authProvider: "email" },
    });
    return sessionResponse(user.id, email);
  }

  if (!existing?.passwordHash || !verifyPassword(password, existing.passwordHash)) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  return sessionResponse(existing.id, email);
}

function sessionResponse(id: string, email: string) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_SESSION_COOKIE, signSession({ id, email }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
