import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Chamado 1x por dia pelo Cron da Vercel (vercel.json). O Supabase gratuito pausa
// o projeto depois de 7 dias sem acesso; esta consulta leve conta como acesso.
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" });
  return NextResponse.json({ ok: !error, em: new Date().toISOString() }, { status: error ? 500 : 200 });
}
