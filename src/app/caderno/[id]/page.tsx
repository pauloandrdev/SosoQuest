import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { sessao } from "@/lib/auth";
import { acertou, temGabarito, type Item } from "@/lib/caderno";
import { pct, fmtData, fmtTempo, plural } from "@/lib/tempo";
import StartPanel from "./StartPanel";
import ApagarCaderno from "./ApagarCaderno";

export const dynamic = "force-dynamic";

type Tent = {
  id: string; user_id: string; modo: string; itens: string[]; respostas: Record<string, string>;
  acertos: number; erros: number; brancos: number; sem_gabarito: number; total: number; segundos: number; feita_em: string;
};

export default async function CadernoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await sessao();
  const { data: c } = await supabase.from("cadernos").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const itens = c.itens as Item[];
  const { data: tdata } = await supabase.from("tentativas").select("*").eq("caderno_id", id).order("feita_em", { ascending: false }).limit(200);
  const tentativas = (tdata ?? []) as Tent[];
  const tutor = perfil.papel === "tutor";

  let nomes: Record<string, string> = {};
  if (tutor) {
    const ids = [...new Set(tentativas.map((t) => t.user_id))];
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, nome").in("id", ids);
      nomes = Object.fromEntries((ps ?? []).map((p) => [p.id, p.nome]));
    }
  }
  const quem = (uid: string) => (uid === perfil.id ? "Você" : nomes[uid] || "Aluno");

  const minhas = tentativas.filter((t) => t.user_id === perfil.id);
  const porId = new Map(itens.map((q) => [q.id, q]));
  const ultima = minhas[0];
  const erradas = ultima
    ? (ultima.itens || []).filter((iid) => { const q = porId.get(iid); return q && temGabarito(q) && !acertou(q, ultima.respostas?.[iid]); })
    : [];
  const tipos = { mc: 0, ce: 0, open: 0 };
  itens.forEach((q) => tipos[q.tipo]++);
  const semGab = itens.filter((q) => !temGabarito(q)).length;
  const nota = (t: Tent) => pct(t.acertos, t.total - t.sem_gabarito);

  const melhores: { nome: string; p: number; t: Tent }[] = [];
  for (const t of tentativas) {
    const n = quem(t.user_id);
    const cur = melhores.find((m) => m.nome === n);
    if (!cur) melhores.push({ nome: n, p: nota(t), t });
    else if (nota(t) > cur.p) Object.assign(cur, { p: nota(t), t });
  }

  const partes = [tipos.mc && `${tipos.mc} múltipla escolha`, tipos.ce && `${tipos.ce} certo/errado`, tipos.open && `${tipos.open} discursivas`].filter(Boolean).join(" · ");

  return (
    <>
      <Header perfil={perfil} />
      <main className="wrap start">
        <Link className="btn ghost" href="/" style={{ justifySelf: "start" }}>← Todos os cadernos</Link>
        <div className="stack" style={{ gap: 8 }}>
          <h1>{c.titulo}</h1>
          {c.descricao && <p>{c.descricao}</p>}
          <p className="muted">{plural(itens.length, "item", "itens")} · {partes}</p>
          {semGab > 0 && <p className="small muted">{plural(semGab, "item está", "itens estão")} sem gabarito e não {semGab === 1 ? "conta" : "contam"} na nota.</p>}
        </div>

        <StartPanel id={id} erradas={erradas} temDiscursiva={tipos.open > 0} />

        {tutor && (
          <div className="row">
            <Link className="btn" href={`/caderno/${id}/editar`}>Editar caderno</Link>
            <ApagarCaderno id={id} />
          </div>
        )}

        {melhores.length > 0 && (
          <section className="stack">
            <h2>{tutor ? "Melhores notas por aluno" : "Sua melhor nota"}</h2>
            <div className="stats">
              {melhores.map((m) => (
                <div className="stat" key={m.nome}>
                  <span className="label">{m.nome}</span>
                  <b>{m.p}%</b>
                  <span className="small muted">{m.t.acertos} de {m.t.total - m.t.sem_gabarito} · {fmtData(m.t.feita_em)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tentativas.length > 0 && (
          <section className="stack">
            <h2>Histórico</h2>
            <div className="tablewrap">
              <table className="hist">
                <thead>
                  <tr>{(tutor ? ["Aluno"] : []).concat(["Quando", "Modo", "Acertos", "Erros", "Branco", "Nota", "Tempo"]).map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {tentativas.slice(0, 50).map((t) => (
                    <tr key={t.id}>
                      {tutor && <td className="wrapc">{quem(t.user_id)}</td>}
                      <td>{fmtData(t.feita_em)}</td>
                      <td>{t.modo === "simulado" ? "Simulado" : "Estudo"}{t.total < itens.length ? " · parcial" : ""}</td>
                      <td className="mono">{t.acertos}</td>
                      <td className="mono">{t.erros}</td>
                      <td className="mono">{t.brancos}</td>
                      <td className="mono">{nota(t)}%</td>
                      <td className="mono">{fmtTempo(t.segundos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
