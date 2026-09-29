import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { sessao } from "@/lib/auth";
import type { Item } from "@/lib/caderno";
import Runner from "./Runner";

export const dynamic = "force-dynamic";

export default async function ResponderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string; embaralhar?: string; so?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await sessao();
  const { data: c } = await supabase.from("cadernos").select("id, titulo, contextos, itens").eq("id", id).maybeSingle();
  if (!c) notFound();
  const itens = c.itens as Item[];
  const modo = sp.modo === "simulado" ? "simulado" : "estudo";

  let ids = itens.map((q) => q.id);
  if (sp.so) {
    const so = new Set(sp.so.split(","));
    const filtrado = ids.filter((i) => so.has(i));
    if (filtrado.length) ids = filtrado;
  }
  if (sp.embaralhar === "1") {
    // embaralha por questão, mantendo juntos os itens do mesmo enunciado
    const porId = new Map(itens.map((q) => [q.id, q]));
    const grupos: { k: string; ids: string[] }[] = [];
    for (const i of ids) {
      const q = porId.get(i)!;
      const k = q.ctx ? "c:" + q.ctx : "g:" + q.grupo;
      const g = grupos.find((x) => x.k === k);
      if (g) g.ids.push(i); else grupos.push({ k, ids: [i] });
    }
    for (let i = grupos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [grupos[i], grupos[j]] = [grupos[j], grupos[i]];
    }
    ids = grupos.flatMap((g) => g.ids);
  }

  return (
    <main className="wrap">
      <Runner
        key={randomUUID()}
        caderno={{ id: c.id, titulo: c.titulo, contextos: (c.contextos ?? {}) as Record<string, string>, itens }}
        ordem={ids}
        modo={modo}
      />
    </main>
  );
}
