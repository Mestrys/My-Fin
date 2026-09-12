import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const requiredToken = process.env.APP_ACCESS_TOKEN;
  if (!requiredToken) {
    return NextResponse.json({ ok: true });
  }

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token || body.token !== requiredToken) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("myfin_access", requiredToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
