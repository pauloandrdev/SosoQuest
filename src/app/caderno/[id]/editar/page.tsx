import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Editor from "@/components/Editor";
import { sessaoTutor } from "@/lib/auth";
import type { CadernoDados, Item } from "@/lib/caderno";

export const dynamic = "force-dynamic";

export default async function EditarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await sessaoTutor();
  const { data: c } = await supabase.from("cadernos").select("id, titulo, descricao, contextos, itens").eq("id", id).maybeSingle();
  if (!c) notFound();
  const inicial: CadernoDados = { titulo: c.titulo, descricao: c.descricao ?? "", contextos: (c.contextos ?? {}) as Record<string, string>, itens: c.itens as Item[] };
  return (
    <>
      <Header perfil={perfil} />
      <main className="wrap stack-lg" style={{ maxWidth: 900 }}>
        <Link className="btn ghost" href={`/caderno/${id}`} style={{ justifySelf: "start" }}>← Voltar ao caderno</Link>
        <h1>Editar caderno</h1>
        <p className="note warn">Mudar o número de um item faz as tentativas antigas perderem o vínculo com ele no &quot;Refazer as que errei&quot;. As notas já registradas não mudam.</p>
        <Editor inicial={inicial} cadernoId={id} />
      </main>
    </>
  );
}
