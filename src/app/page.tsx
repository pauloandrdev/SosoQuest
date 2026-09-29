import Link from "next/link";
import Header from "@/components/Header";
import Icone from "@/components/Icone";
import Vincular from "@/components/Vincular";
import { sessao } from "@/lib/auth";
import { pct, fmtData, plural, nivel } from "@/lib/tempo";

export const dynamic = "force-dynamic";

type Linha = { caderno_id: string; acertos: number; erros: number; brancos: number; sem_gabarito: number; total: number; feita_em: string };

export default async function Dashboard() {
  const { supabase, perfil } = await sessao();
  const [{ data: cadernos, error }, { data: tentativas }] = await Promise.all([
    supabase.from("cadernos").select("id, titulo, descricao, total_itens, criado_em").order("criado_em", { ascending: false }),
    supabase.from("tentativas").select("caderno_id, acertos, erros, brancos, sem_gabarito, total, feita_em").eq("user_id", perfil.id).order("feita_em", { ascending: false }),
  ]);
  const tutor = perfil.papel === "tutor";
  const lista = cadernos ?? [];
  const minhas = (tentativas ?? []) as Linha[];
  const nota = (t: Linha) => pct(t.acertos, t.total - t.sem_gabarito);
  const somaAc = minhas.reduce((s, t) => s + t.acertos, 0);
  const somaGr = minhas.reduce((s, t) => s + (t.total - t.sem_gabarito), 0);
  const feitos = new Set(minhas.map((t) => t.caderno_id)).size;
  const media = pct(somaAc, somaGr);
  const totalItens = lista.reduce((s, c) => s + (c.total_itens ?? 0), 0);
  const primeiroNome = perfil.nome.split(" ")[0];

  const resumo = tutor
    ? lista.length ? `Você tem ${plural(lista.length, "caderno publicado", "cadernos publicados")}.` : "Comece publicando o seu primeiro caderno."
    : !lista.length ? "Assim que houver cadernos, eles aparecem aqui."
    : feitos === lista.length ? "Você já respondeu todos os cadernos. Que tal refazer os que foram pior?"
    : `Você respondeu ${feitos} de ${plural(lista.length, "caderno", "cadernos")}. Bora para o próximo!`;

  return (
    <>
      <Header perfil={perfil} atual="inicio" />
      <main className="wrap stack-lg">
        <section className="hero" aria-label="Resumo">
          <div className="hero-head">
            <div className="stack">
              <span className="label">{tutor ? "Painel do tutor" : "Seu painel"}</span>
              <h1>Olá, {primeiroNome}</h1>
              <p className="muted">{resumo}</p>
            </div>
            {tutor && <Link className="btn primary" href="/tutor/novo"><Icone nome="mais" />Novo caderno</Link>}
          </div>
          {!tutor && lista.length > 0 && (
            <div className="progress-line">
              <div className="meter" aria-hidden="true"><i style={{ width: `${pct(feitos, lista.length)}%` }} /></div>
              <span className="small muted">{pct(feitos, lista.length)}% dos cadernos respondidos</span>
            </div>
          )}
          {(tutor || lista.length > 0) && <div className="stats">
            {tutor ? (
              <>
                <div className="stat"><Icone nome="livro" /><b>{lista.length}</b><span className="small muted">cadernos publicados</span></div>
                <div className="stat"><Icone nome="alvo" /><b>{totalItens}</b><span className="small muted">itens no total</span></div>
                <Link className="stat" href="/tutor/desempenho" style={{ textDecoration: "none" }}>
                  <Icone nome="pessoas" /><b style={{ fontSize: "1.05rem", fontFamily: "var(--f-display)" }}>Ver turma →</b><span className="small muted">notas e código de convite</span>
                </Link>
              </>
            ) : (
              <>
                <div className="stat"><Icone nome="livro" /><b>{feitos}<span className="small muted" style={{ fontSize: "0.9rem" }}>/{lista.length}</span></b><span className="small muted">cadernos feitos</span></div>
                <div className="stat"><Icone nome="repetir" /><b>{minhas.length}</b><span className="small muted">tentativas</span></div>
                <div className={"stat " + (somaGr ? nivel(media) : "")}><Icone nome="alvo" /><b>{somaGr ? `${media}%` : "—"}</b><span className="small muted">acerto médio</span></div>
                <div className="stat"><Icone nome="certo" /><b>{somaAc}</b><span className="small muted">itens acertados</span></div>
              </>
            )}
          </div>}
        </section>

        <section className="stack">
          <div className="sec-head">
            <h2>{tutor ? "Seus cadernos" : "Cadernos"}</h2>
            {lista.length > 0 && <span className="label">{plural(lista.length, "caderno", "cadernos")}</span>}
          </div>
          {error && <p className="err">Não foi possível carregar os cadernos. Recarregue a página.</p>}
          {!lista.length ? (
            <div className="empty">
              <div className="bubbles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <h3>{!tutor && !perfil.tutorId ? "Entre na turma do seu tutor" : "Nenhum caderno ainda"}</h3>
              <p className="muted">
                {tutor
                  ? "Crie o primeiro caderno enviando um arquivo JSON ou montando as questões na tela."
                  : perfil.tutorId
                    ? "Quando o seu tutor publicar um caderno, ele aparece aqui."
                    : "Você ainda não está em nenhuma turma. Peça ao seu tutor o código de convite e digite abaixo."}
              </p>
              {!tutor && !perfil.tutorId && <Vincular />}
              {tutor && <Link className="btn primary" href="/tutor/novo"><Icone nome="mais" />Criar caderno</Link>}
            </div>
          ) : (
            <div className="quiz-list">
              {lista.map((c) => {
                const ts = minhas.filter((t) => t.caderno_id === c.id);
                const ultima = ts[0];
                const melhor = ts.length ? Math.max(...ts.map(nota)) : null;
                return (
                  <Link key={c.id} className="qcard" href={`/caderno/${c.id}`}>
                    <div className="qcard-top">
                      {tutor ? <span className="badge">publicado</span>
                        : melhor != null ? <span className="badge feito">feito</span> : <span className="badge novo">novo</span>}
                      <span className="small muted">{plural(c.total_itens, "item", "itens")}</span>
                    </div>
                    <h3>{c.titulo}</h3>
                    {c.descricao ? <p className="qdesc">{c.descricao}</p> : <span />}
                    <div className="qcard-foot">
                      {melhor != null ? (
                        <>
                          <div className="score"><span className="small muted">Sua melhor nota</span><b className={nivel(melhor)}>{melhor}%</b></div>
                          <div className="meter" aria-hidden="true"><i className={nivel(melhor)} style={{ width: `${melhor}%` }} /></div>
                          <p className="meta">{plural(ts.length, "tentativa", "tentativas")} · última em {fmtData(ultima.feita_em)}</p>
                        </>
                      ) : (
                        <span className="cta">{tutor ? "Abrir caderno" : "Começar"} <Icone nome="seta" tamanho={16} /></span>
                      )}
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
