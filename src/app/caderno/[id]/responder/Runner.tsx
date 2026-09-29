"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RichText from "@/components/RichText";
import { createClient } from "@/lib/supabase/client";
import { rotulo, TIPO_LABEL, type Gabarito, type Item, type ItemAberto } from "@/lib/caderno";
import { fmtTempo, plural } from "@/lib/tempo";
import Resultado from "./Resultado";

export type CadernoRun = { id: string; titulo: string; contextos: Record<string, string>; itens: ItemAberto[] };
type Modo = "estudo" | "simulado";

/* Progresso salvo no navegador, para não perder a prova se a página recarregar. */
type Salvo = {
  ordem: string[]; pos: number; segundos: number; em: number;
  respostas: Record<string, string>; textos: Record<string, string>; mostrou: Record<string, boolean>; gab: Record<string, Gabarito>;
};
const VALIDADE = 7 * 24 * 3600 * 1000;
function ler(chave: string): Salvo | null {
  try {
    const s = JSON.parse(localStorage.getItem(chave) || "null") as Salvo | null;
    return s && Date.now() - s.em < VALIDADE ? s : null;
  } catch { return null; }
}
function gravar(chave: string, s: Salvo) { try { localStorage.setItem(chave, JSON.stringify(s)); } catch {} }
function apagar(chave: string) { try { localStorage.removeItem(chave); } catch {} }

export default function Runner({ caderno, ordem, modo }: { caderno: CadernoRun; ordem: string[]; modo: Modo }) {
  const chave = useMemo(() => `caderno:${caderno.id}:${modo}:${[...ordem].sort().join(",")}`, [caderno.id, modo, ordem]);
  const porId = useMemo(() => new Map(caderno.itens.map((q) => [q.id, q])), [caderno.itens]);
  const [ordemAtual, setOrdemAtual] = useState(ordem);
  const lista = useMemo(() => ordemAtual.map((i) => porId.get(i)!).filter(Boolean), [ordemAtual, porId]);

  const [pos, setPos] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [mostrou, setMostrou] = useState<Record<string, boolean>>({});
  const [gab, setGab] = useState<Record<string, Gabarito>>({});
  const [ctxAberto, setCtxAberto] = useState<Record<string, boolean>>({});
  const [confirmar, setConfirmar] = useState(false);
  const [agora, setAgora] = useState(0);
  const inicio = useRef(0);
  const pedidos = useRef(new Set<string>());
  const [pronto, setPronto] = useState(false);
  const [retomado, setRetomado] = useState(false);
  const [erroRede, setErroRede] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fim, setFim] = useState<null | { segundos: number; lista: Item[] }>(null);
  const [cartaoAberto, setCartaoAberto] = useState(true);

  useEffect(() => {
    const s = ler(chave);
    inicio.current = Date.now() - (s ? s.segundos * 1000 : 0);
    if (s) {
      setOrdemAtual(s.ordem); setPos(s.pos); setRespostas(s.respostas); setTextos(s.textos); setMostrou(s.mostrou); setGab(s.gab);
      setRetomado(true);
    }
    setPronto(true);
    setCartaoAberto(!window.matchMedia("(max-width:860px)").matches);
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [chave]);

  useEffect(() => {
    if (!pronto || fim) return;
    if (!Object.keys(respostas).length && !Object.values(textos).some((t) => t.trim())) return;
    gravar(chave, { ordem: ordemAtual, pos, respostas, textos, mostrou, gab, segundos: Math.round((Date.now() - inicio.current) / 1000), em: Date.now() });
  }, [pronto, fim, chave, ordemAtual, pos, respostas, textos, mostrou, gab, agora]);

  function recomecar() {
    apagar(chave);
    inicio.current = Date.now();
    pedidos.current.clear();
    setOrdemAtual(ordem); setPos(0); setRespostas({}); setTextos({}); setMostrou({}); setGab({}); setConfirmar(false); setRetomado(false);
  }

  /** Busca a resposta de um item no banco (só depois que o aluno marcou ou pediu para ver). */
  const conferir = useCallback(async (id: string) => {
    if (pedidos.current.has(id)) return;
    pedidos.current.add(id);
    const { data, error } = await createClient().rpc("conferir_item", { p_caderno: caderno.id, p_item: id });
    if (error || !data) {
      pedidos.current.delete(id);
      setErroRede("Não foi possível conferir a resposta. Verifique a conexão.");
      return;
    }
    setErroRede("");
    const g = data as Gabarito;
    setGab((cur) => ({ ...cur, [id]: { resposta: g.resposta ?? null, resposta_texto: g.resposta_texto ?? null } }));
  }, [caderno.id]);

  /** Se já dá para saber se o item está certo: discursiva (o aluno marca) ou objetiva com gabarito carregado. */
  const sabe = (x: ItemAberto) => x.gabarito && (x.tipo === "open" || !!gab[x.id]);
  const certo = (x: ItemAberto, r: string | undefined) => (x.tipo === "open" ? r === "=ok" : r === gab[x.id]?.resposta);

  const q = lista[pos];
  const resp = respostas[q?.id];
  const respondidos = lista.filter((x) => respostas[x.id]).length;
  const ultima = pos === lista.length - 1;

  const ir = useCallback((p: number) => {
    setPos(Math.max(0, Math.min(lista.length - 1, p)));
    setConfirmar(false);
    requestAnimationFrame(() => {
      const el = document.querySelector(".qsheet");
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
    });
  }, [lista.length]);

  const marcar = useCallback((item: ItemAberto, k: string) => {
    setRespostas((r) => {
      if (modo === "estudo" && r[item.id]) return r;
      const n = { ...r };
      if (modo === "simulado" && n[item.id] === k) delete n[item.id];
      else n[item.id] = k;
      return n;
    });
    if (modo === "estudo" && item.gabarito) conferir(item.id);
    setConfirmar(false);
  }, [modo, conferir]);

  async function entregar() {
    if (enviando) return;
    const segundos = Math.round((Date.now() - inicio.current) / 1000);
    setEnviando(true);
    setErroRede("");
    const { data, error } = await createClient().rpc("entregar", {
      p_caderno: caderno.id, p_modo: modo, p_itens: lista.map((x) => x.id), p_respostas: respostas, p_segundos: segundos,
    });
    setEnviando(false);
    if (error || !data) {
      setErroRede("Não foi possível entregar. Suas respostas continuam aqui — verifique a conexão e tente de novo.");
      return;
    }
    const g: Record<string, Gabarito> = { ...gab };
    for (const x of (data as { gabarito: ({ id: string } & Gabarito)[] }).gabarito) g[x.id] = { resposta: x.resposta ?? null, resposta_texto: x.resposta_texto ?? null };
    apagar(chave);
    setFim({ segundos, lista: lista.map(({ gabarito: _, ...x }) => ({ ...x, resposta: g[x.id]?.resposta ?? null, resposta_texto: g[x.id]?.resposta_texto ?? null })) });
    window.scrollTo(0, 0);
  }
  function tentarEntregar() {
    const brancos = lista.filter((x) => !respostas[x.id]).length;
    if (brancos && !confirmar) {
      setConfirmar(true);
      if (window.matchMedia("(max-width:860px)").matches) setPos(lista.length - 1);
      requestAnimationFrame(() => document.querySelector(".confirm")?.scrollIntoView({ block: "center" }));
      return;
    }
    entregar();
  }

  useEffect(() => {
    if (fim) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
      const k = e.key.toUpperCase();
      if (k.length === 1 && q && q.opcoes.some((o) => o.key === k)) { e.preventDefault(); marcar(q, k); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (pos < lista.length - 1) ir(pos + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); ir(pos - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, pos, lista.length, fim, ir, marcar]);

  // Item já respondido (ou com gabarito aberto) cuja resposta ainda não veio do banco: busca de novo.
  useEffect(() => {
    if (!q || gab[q.id]) return;
    const precisa = q.tipo === "open" ? mostrou[q.id] : modo === "estudo" && !!resp && q.gabarito;
    if (precisa) conferir(q.id);
  }, [q, resp, mostrou, gab, modo, conferir]);

  if (!lista.length) return <p className="muted">Este caderno não tem itens.</p>;
  if (fim) return <Resultado caderno={caderno} lista={fim.lista} respostas={respostas} textos={textos} modo={modo} segundos={fim.segundos} />;

  const ctxTexto = q.ctx ? caderno.contextos[q.ctx] : null;
  const anterior = pos > 0 ? lista[pos - 1] : null;
  const ctxOpen = q.ctx ? ctxAberto[q.ctx] ?? (!anterior || anterior.ctx !== q.ctx) : false;

  let certas = 0, erradas = 0;
  for (const x of lista) {
    const r = respostas[x.id];
    if (r && sabe(x) && (modo === "estudo" || x.tipo === "open")) { if (certo(x, r)) certas++; else erradas++; }
  }

  const g = gab[q.id];
  let corpo: React.ReactNode;
  let fb: React.ReactNode = null;
  if (q.tipo === "open") {
    const visto = mostrou[q.id];
    corpo = (
      <div className="stack">
        <label className="field">
          <span>Sua resposta</span>
          <textarea className="inp" id={"resp-" + q.id} rows={5} placeholder="Escreva com suas palavras…" value={textos[q.id] ?? ""}
            onChange={(e) => setTextos((t) => ({ ...t, [q.id]: e.target.value }))} />
        </label>
        {!visto ? (
          <div><button className="btn" type="button" onClick={() => { setMostrou((m) => ({ ...m, [q.id]: true })); conferir(q.id); }}>Ver resposta do gabarito</button></div>
        ) : (
          <div className="expected">
            <span className="label" style={{ color: "var(--ok)" }}>Resposta do gabarito</span>
            {!g ? <p className="muted">Carregando…</p>
              : g.resposta_texto ? <RichText text={g.resposta_texto} />
              : <p className="muted">O gabarito não traz resposta para este item. Confira no seu material.</p>}
            <div className="row">
              <span className="small">Você acertou?</span>
              <button className={"btn sm" + (resp === "=ok" ? " primary" : "")} type="button" onClick={() => setRespostas((r) => ({ ...r, [q.id]: "=ok" }))}>Acertei</button>
              <button className={"btn sm" + (resp === "=bad" ? " danger" : "")} type="button" onClick={() => setRespostas((r) => ({ ...r, [q.id]: "=bad" }))}>Errei</button>
            </div>
          </div>
        )}
      </div>
    );
  } else {
    const travado = modo === "estudo" && !!resp;
    const temG = q.gabarito;
    corpo = (
      <div className={"opts" + (q.tipo === "ce" ? " ce" : "")} role="group" aria-label="Alternativas">
        {q.opcoes.map((o) => {
          let cls = "opt";
          if (travado && temG && g) { if (o.key === g.resposta) cls += " right"; else if (resp === o.key) cls += " wrong"; }
          else if (resp === o.key) cls += " sel";
          return (
            <button key={o.key} className={cls} type="button" disabled={travado} aria-pressed={resp === o.key} onClick={() => marcar(q, o.key)}>
              {q.tipo === "mc" && <span className="bub">{o.key}</span>}
              <span className="opt-t">{o.text}</span>
            </button>
          );
        })}
      </div>
    );
    if (travado) {
      fb = !temG ? <p className="fb neutral">Este item está sem gabarito ou foi anulado — não conta na nota.</p>
        : !g ? <p className="fb neutral">Conferindo…</p>
        : resp === g.resposta ? <p className="fb ok">Acertou.</p>
        : <p className="fb bad">{q.tipo === "ce" ? `Errou. O item está ${g.resposta === "C" ? "CERTO" : "ERRADO"}.` : `Errou. A resposta certa é ${g.resposta}.`}</p>;
    }
  }

  const brancos = lista.length - respondidos;
  const decorrido = inicio.current ? (agora - inicio.current) / 1000 : 0;
  const rotuloEntregar = enviando ? "Entregando…" : "Entregar";

  return (
    <div className="run">
      <div className="runbar">
        <div className="t">
          <span className="label">{modo === "estudo" ? "Modo estudo" : "Simulado"}</span>
          <h2>{caderno.titulo}</h2>
        </div>
        <div className="row">
          <span className="mono muted" aria-label="Tempo">{fmtTempo(decorrido)}</span>
          <Link className="btn ghost" href={`/caderno/${caderno.id}`}>Sair</Link>
        </div>
      </div>
      <div className="progress" aria-hidden="true"><i style={{ width: `${(respondidos / lista.length) * 100}%` }} /></div>

      <article className="qsheet">
        {retomado && (
          <div className="note row" style={{ justifyContent: "space-between" }}>
            <span className="small">Você continuou de onde parou. Suas respostas ficam salvas neste navegador até entregar.</span>
            <button className="btn sm" type="button" onClick={recomecar}>Recomeçar do zero</button>
          </div>
        )}
        <div className="qnum">
          <span className="lbl">{rotulo(q)}</span>
          <span className="small muted">{pos + 1} de {lista.length} · {TIPO_LABEL[q.tipo]}</span>
        </div>
        {ctxTexto && (
          <details className="ctxbox" open={ctxOpen} onToggle={(e) => { const aberto = (e.target as HTMLDetailsElement).open; setCtxAberto((c) => (c[q.ctx!] === aberto ? c : { ...c, [q.ctx!]: aberto })); }}>
            <summary><span>Enunciado da questão {q.grupo}</span></summary>
            <RichText text={ctxTexto} />
          </details>
        )}
        <RichText text={q.texto} />
        {corpo}
        {fb}
        <div className="navrow">
          <button className="btn" type="button" disabled={pos === 0} onClick={() => ir(pos - 1)}>← Anterior</button>
          {ultima ? <button className="btn primary" type="button" disabled={enviando} onClick={tentarEntregar}>{rotuloEntregar}</button>
            : <button className="btn primary" type="button" onClick={() => ir(pos + 1)}>Próxima →</button>}
        </div>
        {confirmar && (
          <div className="confirm">
            <span>Você deixou {plural(brancos, "item", "itens")} em branco. Entregar assim mesmo?</span>
            <button className="btn primary" type="button" disabled={enviando} onClick={entregar}>{rotuloEntregar}</button>
            <button className="btn" type="button" onClick={() => setConfirmar(false)}>Continuar</button>
          </div>
        )}
        {erroRede && <p className="err" role="alert">{erroRede}</p>}
        <p className="kbd">Atalhos: <kbd>A</kbd>–<kbd>E</kbd> marcam (<kbd>C</kbd>/<kbd>E</kbd> no Certo/Errado), <kbd>←</kbd> <kbd>→</kbd> navegam.</p>
      </article>

      <aside className="card-sheet">
        <details open={cartaoAberto} onToggle={(e) => setCartaoAberto((e.target as HTMLDetailsElement).open)}>
          <summary><span className="label">Cartão-resposta</span><span className="mono small">{respondidos}/{lista.length}</span></summary>
          {(modo === "estudo" || certas + erradas > 0) && (
            <div className="legend">
              <span><i style={{ background: "var(--ok)" }} />{certas} certas</span>
              <span><i style={{ background: "var(--bad)" }} />{erradas} erradas</span>
            </div>
          )}
          <div className="grid-sheet">
            {lista.map((x, p) => {
              const r = respostas[x.id];
              let cls = "cell";
              if (p === pos) cls += " cur";
              if (r) cls += (modo === "estudo" || x.tipo === "open") && sabe(x) ? (certo(x, r) ? " ok" : " bad") : " ans";
              return (
                <button key={x.id} className={cls} type="button" aria-label={`Item ${x.id}${r ? ", respondido" : ""}`} onClick={() => ir(p)}>
                  <small>{x.id}</small><i>{r && r[0] !== "=" ? r : ""}</i>
                </button>
              );
            })}
          </div>
          <button className="btn" type="button" disabled={enviando} onClick={tentarEntregar} style={{ width: "100%" }}>{enviando ? "Entregando…" : "Entregar prova"}</button>
        </details>
      </aside>

      <nav className="mnav" aria-label="Navegação entre itens">
        <button className="btn" type="button" disabled={pos === 0} onClick={() => ir(pos - 1)}>← Anterior</button>
        <span className="pos">{pos + 1}/{lista.length}</span>
        {ultima ? <button className="btn primary" type="button" disabled={enviando} onClick={tentarEntregar}>{rotuloEntregar}</button>
          : <button className="btn primary" type="button" onClick={() => ir(pos + 1)}>Próxima →</button>}
      </nav>
    </div>
  );
}
