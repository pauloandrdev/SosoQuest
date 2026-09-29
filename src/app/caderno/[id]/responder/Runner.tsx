"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RichText from "@/components/RichText";
import { createClient } from "@/lib/supabase/client";
import { acertou, corrigir, rotulo, temGabarito, TIPO_LABEL, type Item } from "@/lib/caderno";
import { fmtTempo, plural } from "@/lib/tempo";
import Resultado from "./Resultado";

export type CadernoRun = { id: string; titulo: string; contextos: Record<string, string>; itens: Item[] };
type Modo = "estudo" | "simulado";

export default function Runner({ caderno, ordem, modo }: { caderno: CadernoRun; ordem: string[]; modo: Modo }) {
  const porId = useMemo(() => new Map(caderno.itens.map((q) => [q.id, q])), [caderno.itens]);
  const lista = useMemo(() => ordem.map((i) => porId.get(i)!).filter(Boolean), [ordem, porId]);

  const [pos, setPos] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [mostrou, setMostrou] = useState<Record<string, boolean>>({});
  const [ctxAberto, setCtxAberto] = useState<Record<string, boolean>>({});
  const [confirmar, setConfirmar] = useState(false);
  const [agora, setAgora] = useState(0);
  const inicio = useRef(0);
  const [fim, setFim] = useState<null | { segundos: number; salvo: "salvando" | "ok" | "erro" }>(null);
  const [cartaoAberto, setCartaoAberto] = useState(true);

  useEffect(() => {
    inicio.current = Date.now();
    setCartaoAberto(!window.matchMedia("(max-width:860px)").matches);
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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

  const marcar = useCallback((item: Item, k: string) => {
    setRespostas((r) => {
      if (modo === "estudo" && r[item.id]) return r;
      const n = { ...r };
      if (modo === "simulado" && n[item.id] === k) delete n[item.id];
      else n[item.id] = k;
      return n;
    });
    setConfirmar(false);
  }, [modo]);

  async function entregar() {
    const segundos = Math.round((Date.now() - inicio.current) / 1000);
    setFim({ segundos, salvo: "salvando" });
    window.scrollTo(0, 0);
    const placar = corrigir(lista, respostas);
    const { error } = await createClient().from("tentativas").insert({
      caderno_id: caderno.id, modo, itens: lista.map((x) => x.id), respostas, segundos, ...placar,
    });
    setFim({ segundos, salvo: error ? "erro" : "ok" });
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

  if (!lista.length) return <p className="muted">Este caderno não tem itens.</p>;
  if (fim) return <Resultado caderno={caderno} lista={lista} respostas={respostas} textos={textos} modo={modo} segundos={fim.segundos} salvo={fim.salvo} />;

  const ctxTexto = q.ctx ? caderno.contextos[q.ctx] : null;
  const anterior = pos > 0 ? lista[pos - 1] : null;
  const ctxOpen = q.ctx ? ctxAberto[q.ctx] ?? (!anterior || anterior.ctx !== q.ctx) : false;

  let certas = 0, erradas = 0;
  for (const x of lista) {
    const r = respostas[x.id];
    if (r && temGabarito(x) && (modo === "estudo" || x.tipo === "open")) { if (acertou(x, r)) certas++; else erradas++; }
  }

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
          <div><button className="btn" type="button" onClick={() => setMostrou((m) => ({ ...m, [q.id]: true }))}>Ver resposta do gabarito</button></div>
        ) : (
          <div className="expected">
            <span className="label" style={{ color: "var(--ok)" }}>Resposta do gabarito</span>
            {q.resposta_texto ? <RichText text={q.resposta_texto} /> : <p className="muted">O gabarito não traz resposta para este item. Confira no seu material.</p>}
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
    const temG = temGabarito(q);
    corpo = (
      <div className={"opts" + (q.tipo === "ce" ? " ce" : "")} role="group" aria-label="Alternativas">
        {q.opcoes.map((o) => {
          let cls = "opt";
          if (travado && temG) { if (o.key === q.resposta) cls += " right"; else if (resp === o.key) cls += " wrong"; }
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
      fb = !temG ? <p className="fb neutral">{q.resposta === "X" ? "Item anulado — não conta na nota." : "Este item está sem gabarito."}</p>
        : resp === q.resposta ? <p className="fb ok">Acertou.</p>
        : <p className="fb bad">{q.tipo === "ce" ? `Errou. O item está ${q.resposta === "C" ? "CERTO" : "ERRADO"}.` : `Errou. A resposta certa é ${q.resposta}.`}</p>;
    }
  }

  const brancos = lista.length - respondidos;
  const decorrido = inicio.current ? (agora - inicio.current) / 1000 : 0;

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
          {ultima ? <button className="btn primary" type="button" onClick={tentarEntregar}>Entregar</button>
            : <button className="btn primary" type="button" onClick={() => ir(pos + 1)}>Próxima →</button>}
        </div>
        {confirmar && (
          <div className="confirm">
            <span>Você deixou {plural(brancos, "item", "itens")} em branco. Entregar assim mesmo?</span>
            <button className="btn primary" type="button" onClick={entregar}>Entregar</button>
            <button className="btn" type="button" onClick={() => setConfirmar(false)}>Continuar</button>
          </div>
        )}
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
              if (r) cls += (modo === "estudo" || x.tipo === "open") && temGabarito(x) ? (acertou(x, r) ? " ok" : " bad") : " ans";
              return (
                <button key={x.id} className={cls} type="button" aria-label={`Item ${x.id}${r ? ", respondido" : ""}`} onClick={() => ir(p)}>
                  <small>{x.id}</small><i>{r && r[0] !== "=" ? r : ""}</i>
                </button>
              );
            })}
          </div>
          <button className="btn" type="button" onClick={tentarEntregar} style={{ width: "100%" }}>Entregar prova</button>
        </details>
      </aside>

      <nav className="mnav" aria-label="Navegação entre itens">
        <button className="btn" type="button" disabled={pos === 0} onClick={() => ir(pos - 1)}>← Anterior</button>
        <span className="pos">{pos + 1}/{lista.length}</span>
        {ultima ? <button className="btn primary" type="button" onClick={tentarEntregar}>Entregar</button>
          : <button className="btn primary" type="button" onClick={() => ir(pos + 1)}>Próxima →</button>}
      </nav>
    </div>
  );
}
