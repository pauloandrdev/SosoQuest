import Link from "next/link";
import Header from "@/components/Header";
import Vincular from "@/components/Vincular";
import { sessao } from "@/lib/auth";
import { pct, fmtData, plural } from "@/lib/tempo";

export const dynamic = "force-dynamic";

type Linha = { caderno_id: string; acertos: number; erros: number; brancos: number; sem_gabarito: number; total: number; feita_em: string };

export default async function Dashboard() {
  const { supabase, perfil } = await sessao();
  const [{ data: cadernos, error }, { data: tentativas }] = await Promise.all([
    supabase.from("cadernos").select("id, titulo, descricao, total_itens, criado_em").order("criado_em", { ascending: false }),
    supabase.from("tentativas").select("caderno_id, acertos, erros, brancos, sem_gabarito, total, feita_em").eq("user_id", perfil.id).order("feita_em", { ascending: false }),
  ]);
  const minhas = (tentativas ?? []) as Linha[];
  const nota = (t: Linha) => pct(t.acertos, t.total - t.sem_gabarito);
  const somaAc = minhas.reduce((s, t) => s + t.acertos, 0);
  const somaGr = minhas.reduce((s, t) => s + (t.total - t.sem_gabarito), 0);
  const feitos = new Set(minhas.map((t) => t.caderno_id)).size;

  return (
    <>
      <Header perfil={perfil} atual="inicio" />
      <main className="wrap stack-lg">
        <div className="sec-head">
          <h1>Olá, {perfil.nome.split(" ")[0]}</h1>
          {perfil.papel === "tutor" && <Link className="btn primary" href="/tutor/novo">Novo caderno</Link>}
        </div>

        <section className="stack" aria-label="Suas pontuações">
          <span className="label">Suas pontuações</span>
          <div className="stats">
            <div className="stat"><b>{feitos}</b><span className="small muted">de {cadernos?.length ?? 0} cadernos feitos</span></div>
            <div className="stat"><b>{minhas.length}</b><span className="small muted">tentativas</span></div>
            <div className="stat ok"><b>{pct(somaAc, somaGr)}%</b><span className="small muted">acerto médio</span></div>
            <div className="stat"><b>{somaAc}</b><span className="small muted">itens acertados</span></div>
          </div>
        </section>

        <section className="stack">
          <div className="sec-head">
            <h2>Cadernos</h2>
            {!!cadernos?.length && <span className="label">{plural(cadernos.length, "caderno", "cadernos")}</span>}
          </div>
          {error && <p className="err">Não foi possível carregar os cadernos. Recarregue a página.</p>}
          {!cadernos?.length ? (
            <div className="empty">
              <div className="bubbles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <h3>Nenhum caderno ainda</h3>
              <p className="muted">
                {perfil.papel === "tutor"
                  ? "Crie o primeiro caderno enviando um arquivo JSON ou montando as questões na tela."
                  : perfil.tutorId
                    ? "Quando o seu tutor publicar um caderno, ele aparece aqui."
                    : "Você ainda não está em nenhuma turma. Peça ao seu tutor o código de convite e digite abaixo."}
              </p>
              {perfil.papel === "aluno" && !perfil.tutorId && <Vincular />}
              {perfil.papel === "tutor" && <Link className="btn primary" href="/tutor/novo">Criar caderno</Link>}
            </div>
          ) : (
            <div className="quiz-list">
              {cadernos.map((c) => {
                const ts = minhas.filter((t) => t.caderno_id === c.id);
                const ultima = ts[0];
                const melhor = ts.length ? Math.max(...ts.map(nota)) : null;
                return (
                  <Link key={c.id} className="qcard" href={`/caderno/${c.id}`}>
                    <h3>{c.titulo}</h3>
                    <p className="meta">
                      {plural(c.total_itens, "item", "itens")}
                      {ts.length ? ` · ${plural(ts.length, "tentativa", "tentativas")} · última em ${fmtData(ultima.feita_em)}` : ""}
                      {c.descricao ? ` · ${c.descricao}` : ""}
                    </p>
                    <div className="score">
                      {melhor != null ? (<><b>{melhor}%</b><span className="small muted">sua melhor</span></>) : <span className="small muted">não respondido</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
