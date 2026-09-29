import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { destino } from "@/lib/destino";

// Links de e-mail do Supabase (confirmar cadastro, recuperar senha) caem aqui.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = destino(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?erro=link", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
