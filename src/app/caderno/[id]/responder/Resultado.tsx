"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RichText from "@/components/RichText";
import { acertou, corrigir, rotulo, temGabarito, type Item } from "@/lib/caderno";
import { fmtTempo, pct } from "@/lib/tempo";
import type { CadernoRun } from "./Runner";

type Filtro = "erradas" | "branco" | "todas";

export default function Resultado({ caderno, lista, respostas, textos, modo, segundos }: {
  caderno: CadernoRun; lista: Item[]; respostas: Record<string, string>; textos: Record<string, string>;
  modo: "estudo" | "simulado"; segundos: number;
}) {
  const router = useRouter();
  const p = corrigir(lista, respostas);
  const g = p.total - p.sem_gabarito;
  const w = (n: number) => (g ? `${(n / g) * 100}%` : "0");
  const [filtro, setFiltro] = useState<Filtro>(p.erros + p.brancos ? "erradas" : "todas");
  const indice = new Map(caderno.itens.map((q, i) => [q.id, i]));
  const ordenada = [...lista].sort((a, b) => (indice.get(a.id) ?? 0) - (indice.get(b.id) ?? 0));
  const refazer = ordenada.filter((q) => temGabarito(q) && !acertou(q, respostas[q.id])).map((q) => q.id);
  const visiveis = ordenada.filter((q) => {
    const r = respostas[q.id];
    if (filtro === "erradas") return temGabarito(q) && r && !acertou(q, r);
    if (filtro === "branco") return temGabarito(q) && !r;
    return true;
  });

  return (
    <div className="stack-lg">
      <section className="scorehead">
        <div className="stack" style={{ gap: 6 }}><span className="label">Resultado</span><h1>{caderno.titulo}</h1></div>
        <div className="big"><b>{p.acertos}/{g}</b><span>{pct(p.acertos, g)}% de acerto</span></div>
        <div className="bar" role="img" aria-label={`${p.acertos} acertos, ${p.erros} erros, ${p.brancos} em branco`}>
          <i style={{ width: w(p.acertos), background: "var(--ok)" }} />
          <i style={{ width: w(p.erros), background: "var(--bad)" }} />
        </div>
        <div className="stats">
          <div className="stat ok"><b>{p.acertos}</b><span className="small muted">acertos</span></div>
          <div className="stat bad"><b>{p.erros}</b><span className="small muted">erros</span></div>
          <div className="stat"><b>{p.brancos}</b><span className="small muted">em branco</span></div>
          {p.sem_gabarito > 0 && <div className="stat"><b>{p.sem_gabarito}</b><span className="small muted">sem gabarito</span></div>}
          <div className="stat"><b>{fmtTempo(segundos)}</b><span className="small muted">tempo</span></div>
        </div>
        <p className="small muted">Resultado salvo no seu histórico.</p>
        <div className="row">
          {refazer.length > 0 && (
            <button className="btn primary" type="button" onClick={() => router.push(`/caderno/${caderno.id}/responder?${new URLSearchParams({ modo, so: refazer.join(",") })}`)}>
              Refazer as {refazer.length} erradas e em branco
            </button>
          )}
          <Link className="btn" href={`/caderno/${caderno.id}`}>Voltar ao caderno</Link>
          <Link className="btn ghost" href="/">Todos os cadernos</Link>
        </div>
      </section>

      <section className="card-sheet" style={{ position: "static" }}>
        <span className="label">Cartão-resposta corrigido</span>
        <div className="legend">
          <span><i style={{ background: "var(--ok)" }} />certo</span>
          <span><i style={{ background: "var(--bad)" }} />errado</span>
          <span><i style={{ border: "1.5px dashed var(--guide)" }} />em branco</span>
        </div>
        <div className="grid-sheet" style={{ maxHeight: "none" }}>
          {ordenada.map((q) => {
            const r = respostas[q.id];
            const cls = !temGabarito(q) ? "void" : !r ? "blank" : acertou(q, r) ? "ok" : "bad";
            return (
              <button key={q.id} className={"cell " + cls} type="button" aria-label={`Item ${q.id}`}
                onClick={() => { setFiltro("todas"); requestAnimationFrame(() => document.getElementById("rq-" + q.id)?.scrollIntoView({ block: "start", behavior: "smooth" })); }}>
                <small>{q.id}</small><i>{r && r[0] !== "=" ? r : ""}</i>
              </button>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <h2>Revisão</h2>
        <div className="tabs">
          {([["erradas", "Erradas", p.erros], ["branco", "Em branco", p.brancos], ["todas", "Todas", p.total]] as const).map(([k, l, n]) => (
            <button key={k} className="tab" type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l} ({n})</button>
          ))}
        </div>
        {visiveis.length ? (
          <div className="stack">
            {visiveis.map((q) => <Revisao key={q.id} q={q} r={respostas[q.id]} digitado={textos[q.id]} ctx={q.ctx ? caderno.contextos[q.ctx] : null} />)}
          </div>
        ) : (
          <p className="muted">{filtro === "erradas" ? "Nenhuma errada. Mandou bem." : "Nada aqui."}</p>
        )}
      </section>
    </div>
  );
}

function Revisao({ q, r, digitado, ctx }: { q: Item; r?: string; digitado?: string; ctx: string | null }) {
  const temG = temGabarito(q);
  const status = !temG ? (q.resposta === "X" ? "anulado" : "sem gabarito") : !r ? "em branco" : acertou(q, r) ? "certo"
    : q.tipo === "open" ? "errou" : `você marcou ${q.tipo === "ce" ? (r === "C" ? "Certo" : "Errado") : r}`;
  const cor = !temG || !r ? "var(--muted)" : acertou(q, r) ? "var(--ok)" : "var(--bad)";
  return (
    <article className="rev" id={"rq-" + q.id}>
      <div className="qnum"><span className="lbl">{rotulo(q)}</span><span className="small" style={{ color: cor }}>{status}</span></div>
      {ctx && (
        <details className="ctxbox"><summary><span>Enunciado da questão {q.grupo}</span></summary><RichText text={ctx} /></details>
      )}
      <RichText text={q.texto} />
      {q.tipo === "open" ? (
        <div className="stack">
          {digitado && <div className="note"><span className="label">Sua resposta</span><RichText text={digitado} /></div>}
          <div className="expected">
            <span className="label" style={{ color: "var(--ok)" }}>Resposta do gabarito</span>
            {q.resposta_texto ? <RichText text={q.resposta_texto} /> : <p className="muted">Sem resposta no gabarito.</p>}
          </div>
        </div>
      ) : (
        <div className={"opts" + (q.tipo === "ce" ? " ce" : "")}>
          {q.opcoes.map((o) => {
            let cls = "opt";
            if (temG && o.key === q.resposta) cls += " right";
            else if (r === o.key) cls += temG ? " wrong" : " sel";
            return (
              <div key={o.key} className={cls}>
                {q.tipo === "mc" && <span className="bub">{o.key}</span>}
                <span className="opt-t">{o.text}</span>
                {q.tipo === "mc" && temG && o.key === q.resposta && <span className="mark" style={{ color: "var(--ok)" }}>gabarito</span>}
                {q.tipo === "mc" && r === o.key && o.key !== q.resposta && <span className="mark" style={{ color: "var(--bad)" }}>sua</span>}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
