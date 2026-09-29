import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Icone from "@/components/Icone";
import { sessao } from "@/lib/auth";
import type { ItemAberto, StatusItem } from "@/lib/caderno";
import { pct, fmtData, fmtTempo, nivel } from "@/lib/tempo";
import StartPanel from "./StartPanel";
import ApagarCaderno from "./ApagarCaderno";

export const dynamic = "force-dynamic";

type Tent = {
  id: string; user_id: string; modo: string; itens: string[]; respostas: Record<string, string>;
  acertos: number; erros: number; brancos: number; sem_gabarito: number; total: number; segundos: number; feita_em: string;
  resultado: Record<string, StatusItem> | null;
};

export default async function CadernoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await sessao();
  const [{ data: c }, { data: itensData }] = await Promise.all([
    supabase.from("cadernos").select("id, titulo, descricao").eq("id", id).maybeSingle(),
    supabase.rpc("itens_para_responder", { p_caderno: id }), // sem gabarito
  ]);
  if (!c) notFound();
  const itens = (itensData ?? []) as ItemAberto[];
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
  const existe = new Set(itens.map((q) => q.id));
  const ultima = minhas[0];
  // Erradas e em branco da última tentativa, pelo resultado que o banco calculou.
  const erradas = ultima
    ? (ultima.itens || []).filter((iid) => existe.has(iid) && (ultima.resultado?.[iid] === "bad" || ultima.resultado?.[iid] === "blank"))
    : [];
  const tipos = { mc: 0, ce: 0, open: 0 };
  itens.forEach((q) => tipos[q.tipo]++);
  const semGab = itens.filter((q) => !q.gabarito).length;
  const nota = (t: Tent) => pct(t.acertos, t.total - t.sem_gabarito);

  const melhores: { nome: string; p: number; t: Tent }[] = [];
  for (const t of tutor ? tentativas : minhas) {
    const n = quem(t.user_id);
    const cur = melhores.find((m) => m.nome === n);
    if (!cur) melhores.push({ nome: n, p: nota(t), t });
    else if (nota(t) > cur.p) Object.assign(cur, { p: nota(t), t });
  }

  const historico = tutor ? tentativas : minhas;

  return (
    <>
      <Header perfil={perfil} />
      <main className="wrap start">
        <Link className="back" href="/"><Icone nome="voltar" tamanho={16} />Todos os cadernos</Link>
        <div className="page-head">
          <h1>{c.titulo}</h1>
          {c.descricao && <p className="muted" style={{ fontSize: "1.05rem" }}>{c.descricao}</p>}
          <div className="chips">
            <span className="chip"><b>{itens.length}</b> {itens.length === 1 ? "item" : "itens"}</span>
            {tipos.mc > 0 && <span className="chip"><b>{tipos.mc}</b> múltipla escolha</span>}
            {tipos.ce > 0 && <span className="chip"><b>{tipos.ce}</b> certo/errado</span>}
            {tipos.open > 0 && <span className="chip"><b>{tipos.open}</b> {tipos.open === 1 ? "discursiva" : "discursivas"}</span>}
            {semGab > 0 && <span className="chip warn"><b>{semGab}</b> sem gabarito (não {semGab === 1 ? "conta" : "contam"} na nota)</span>}
          </div>
        </div>

        <StartPanel id={id} erradas={erradas} temDiscursiva={tipos.open > 0} />

        {tutor && (
          <div className="row">
            <Link className="btn" href={`/caderno/${id}/editar`}><Icone nome="lapis" tamanho={16} />Editar caderno</Link>
            <ApagarCaderno id={id} />
          </div>
        )}

        {melhores.length > 0 && (
          <section className="stack">
            <h2>{tutor ? "Melhores notas por aluno" : "Sua melhor nota"}</h2>
            <div className="stats">
              {melhores.map((m) => (
                <div className={"stat " + nivel(m.p)} key={m.nome}>
                  <span className="label">{m.nome}</span>
                  <b>{m.p}%</b>
                  <span className="small muted">{m.t.acertos} de {m.t.total - m.t.sem_gabarito} · {fmtData(m.t.feita_em)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {historico.length > 0 && (
          <section className="stack">
            <h2>Histórico</h2>
            <div className="tablecard">
              <div className="tablewrap">
                <table className="hist">
                  <thead>
                    <tr>{(tutor ? ["Aluno"] : []).concat(["Quando", "Modo", "Acertos", "Erros", "Branco", "Nota", "Tempo"]).map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {historico.slice(0, 50).map((t) => (
                      <tr key={t.id}>
                        {tutor && <td className="wrapc">{quem(t.user_id)}</td>}
                        <td>{fmtData(t.feita_em)}</td>
                        <td>{t.modo === "simulado" ? "Simulado" : "Estudo"}{t.total < itens.length ? " · parcial" : ""}</td>
                        <td className="mono">{t.acertos}</td>
                        <td className="mono">{t.erros}</td>
                        <td className="mono">{t.brancos}</td>
                        <td><span className={"pill " + nivel(nota(t))}>{nota(t)}%</span></td>
                        <td className="mono">{fmtTempo(t.segundos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
