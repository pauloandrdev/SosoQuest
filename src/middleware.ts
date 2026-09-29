import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          if (headers) Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // getClaims valida o token localmente (chaves assimétricas) em vez de consultar o Auth a cada página.
  // As páginas continuam confirmando o usuário com getUser() em sessao().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const path = request.nextUrl.pathname;
  const publica = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/api/manter-ativo");

  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Guarda para onde a pessoa ia (ex.: link de convite) para voltar depois do login.
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  // Quem já está logado e abre /login é mandado para dentro pela própria página de login,
  // que confere a sessão no servidor (getUser). Fazer isso aqui, só com o token (getClaims),
  // criava um loop quando a sessão tinha sido encerrada mas o token ainda não tinha expirado.
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
