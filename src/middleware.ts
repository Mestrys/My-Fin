import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Gate opcional para deploy público.
 *
 * Sem `APP_ACCESS_TOKEN` o app permanece aberto (uso local / rede privada).
 * Com o token configurado, exige cookie `myfin_access` igual ao segredo —
 * suficiente para um PFM pessoal sem OAuth completo. Não exponha o site
 * na internet sem definir esse token.
 */
export function middleware(request: NextRequest) {
  const requiredToken = process.env.APP_ACCESS_TOKEN;
  if (!requiredToken) return NextResponse.next();

  const cookie = request.cookies.get("myfin_access")?.value;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (cookie === requiredToken || bearer === requiredToken) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/api/login") {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
