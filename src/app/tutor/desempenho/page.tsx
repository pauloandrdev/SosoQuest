import Header from "@/components/Header";
import { sessaoTutor } from "@/lib/auth";
import { fmtData, pct } from "@/lib/tempo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Desempenho · Caderno de Questões" };

type T = { caderno_id: string; user_id: string; acertos: number; total: number; sem_gabarito: number; feita_em: string };

export default async function DesempenhoPage() {
  const { supabase, perfil } = await sessaoTutor();
  const [{ data: perfis }, { data: cadernos }, { data: tent }] = await Promise.all([
    supabase.from("profiles").select("id, nome, papel").order("nome"),
    supabase.from("cadernos").select("id, titulo").order("criado_em", { ascending: false }),
    supabase.from("tentativas").select("caderno_id, user_id, acertos, total, sem_gabarito, feita_em").order("feita_em", { ascending: false }).limit(5000),
  ]);
  const ts = (tent ?? []) as T[];
  const alunos = (perfis ?? []).filter((p) => p.papel === "aluno");
  const cads = cadernos ?? [];
  const nota = (t: T) => pct(t.acertos, t.total - t.sem_gabarito);

  const linhas = alunos.map((a) => {
    const minhas = ts.filter((t) => t.user_id === a.id);
    const ac = minhas.reduce((s, t) => s + t.acertos, 0);
    const gr = minhas.reduce((s, t) => s + t.total - t.sem_gabarito, 0);
    const melhor = Object.fromEntries(cads.map((c) => {
      const doCad = minhas.filter((t) => t.caderno_id === c.id);
      return [c.id, doCad.length ? Math.max(...doCad.map(nota)) : null];
    }));
    return { a, n: minhas.length, feitos: new Set(minhas.map((t) => t.caderno_id)).size, media: pct(ac, gr), ultima: minhas[0]?.feita_em, melhor };
  });

  return (
    <>
      <Header perfil={perfil} atual="desempenho" />
      <main className="wrap stack-lg">
        <h1>Desempenho dos alunos</h1>
        {!alunos.length ? (
          <div className="empty">
            <h3>Nenhum aluno vinculado</h3>
            <p className="muted">Quando um aluno for vinculado a você, ele aparece aqui.</p>
          </div>
        ) : (
          <>
            <section className="stack">
              <h2>Resumo</h2>
              <div className="tablewrap">
                <table className="hist">
                  <thead><tr><th>Aluno</th><th>Tentativas</th><th>Cadernos feitos</th><th>Acerto médio</th><th>Última atividade</th></tr></thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.a.id}>
                        <td className="wrapc">{l.a.nome || "Sem nome"}</td>
                        <td className="mono">{l.n}</td>
                        <td className="mono">{l.feitos} de {cads.length}</td>
                        <td className="mono">{l.n ? `${l.media}%` : "—"}</td>
                        <td>{l.ultima ? fmtData(l.ultima) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {cads.length > 0 && (
              <section className="stack">
                <h2>Melhor nota por caderno</h2>
                <div className="tablewrap">
                  <table className="hist">
                    <thead><tr><th>Caderno</th>{linhas.map((l) => <th key={l.a.id}>{l.a.nome || "Sem nome"}</th>)}</tr></thead>
                    <tbody>
                      {cads.map((c) => (
                        <tr key={c.id}>
                          <td className="wrapc">{c.titulo}</td>
                          {linhas.map((l) => <td key={l.a.id} className="mono">{l.melhor[c.id] == null ? "—" : `${l.melhor[c.id]}%`}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
