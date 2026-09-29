"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALPHA, CE, limpar, paraJson, TIPO_LABEL, type CadernoDados, type Item, type Tipo } from "@/lib/caderno";

const semGab = (q: Item) => q.tipo !== "open" && !q.resposta;
const resumo = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

export default function Editor({ inicial, cadernoId, avisos = [] }: { inicial: CadernoDados; cadernoId?: string; avisos?: string[] }) {
  const router = useRouter();
  const [d, setD] = useState<CadernoDados>(() => structuredClone(inicial));
  const [editando, setEditando] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const atualizar = (fn: (x: CadernoDados) => void) => setD((cur) => { const n = structuredClone(cur); fn(n); return n; });

  const grupos = useMemo(() => {
    const gs: { grupo: string; ctx: string | null; idx: number[] }[] = [];
    d.itens.forEach((q, i) => {
      const g = gs[gs.length - 1];
      if (g && g.grupo === q.grupo && g.ctx === q.ctx) g.idx.push(i);
      else gs.push({ grupo: q.grupo, ctx: q.ctx, idx: [i] });
    });
    return gs;
  }, [d.itens]);

  const conta = (t: Tipo) => d.itens.filter((q) => q.tipo === t).length;
  const faltam = d.itens.filter(semGab).length;

  function novoItem(tipo: Tipo) {
    atualizar((x) => {
      const ultimo = x.itens[x.itens.length - 1];
      const grupo = String((parseInt(ultimo?.grupo ?? "0", 10) || x.itens.length) + 1);
      let id = grupo;
      for (let n = 2; x.itens.some((q) => q.id === id); n++) id = `${grupo}-${n}`;
      x.itens.push({ id, grupo, ctx: null, tipo, texto: "Novo item — escreva o enunciado", opcoes: tipo === "mc" ? [{ key: "A", text: "Alternativa A" }, { key: "B", text: "Alternativa B" }] : tipo === "ce" ? CE() : [], resposta: null, resposta_texto: null });
    });
    setEditando(d.itens.length);
  }

  function baixar() {
    const blob = new Blob([JSON.stringify(paraJson(limpar(d)), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (d.titulo || "caderno").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function salvar() {
    setErro("");
    const dados = limpar(d);
    if (!dados.itens.length) { setErro("Adicione pelo menos um item."); return; }
    const ruins = dados.itens.filter((q) => q.tipo === "mc" && q.opcoes.length < 2).map((q) => q.id);
    if (ruins.length) { setErro(`Itens de múltipla escolha precisam de pelo menos 2 alternativas: ${ruins.join(", ")}.`); return; }
    const ids = dados.itens.map((q) => q.id);
    const rep = ids.filter((v, i) => ids.indexOf(v) !== i);
    if (rep.length) { setErro(`Números de item repetidos: ${[...new Set(rep)].join(", ")}. Cada item precisa de um número único.`); return; }
    setSalvando(true);
    const supabase = createClient();
    const res = cadernoId
      ? await supabase.from("cadernos").update({ ...dados, atualizado_em: new Date().toISOString() }).eq("id", cadernoId).select("id").single()
      : await supabase.from("cadernos").insert(dados).select("id").single();
    setSalvando(false);
    if (res.error || !res.data) {
      setErro(/row-level security|permission/i.test(res.error?.message ?? "") ? "Só tutores podem salvar cadernos." : "Não foi possível salvar. Tente de novo.");
      return;
    }
    router.push(`/caderno/${res.data.id}`);
    router.refresh();
  }

  return (
    <div className="stack-lg">
      <div className="stack">
        <label className="field"><span className="label">Título</span>
          <input className="inp" id="titulo" value={d.titulo} onChange={(e) => atualizar((x) => { x.titulo = e.target.value; })}
            style={{ font: "800 1.4rem/1.2 var(--f-display)", background: "var(--sheet)" }} />
        </label>
        <label className="field"><span className="label">Descrição (opcional)</span>
          <input className="inp" id="descricao" value={d.descricao} placeholder="Ex.: Lista 3 — jornada, férias e FGTS" onChange={(e) => atualizar((x) => { x.descricao = e.target.value; })} />
        </label>
      </div>

      <div className="chips">
        <span className="chip"><b>{d.itens.length}</b> itens</span>
        {conta("mc") > 0 && <span className="chip"><b>{conta("mc")}</b> múltipla escolha</span>}
        {conta("ce") > 0 && <span className="chip"><b>{conta("ce")}</b> certo/errado</span>}
        {conta("open") > 0 && <span className="chip"><b>{conta("open")}</b> discursivas</span>}
        {faltam ? <span className="chip warn"><b>{faltam}</b> sem gabarito</span> : <span className="chip ok">gabarito completo</span>}
      </div>
      {avisos.length > 0 && <div className="note warn">{avisos.map((a, i) => <p key={i}>{a}</p>)}</div>}

      <div className="rv-list">
        {grupos.map((g) => (
          <div className="grp" key={g.idx[0]}>
            {(g.ctx || g.idx.length > 1) && (
              <div className="grp-head">
                <span className="label">Questão {g.grupo}{g.idx.length > 1 ? ` · ${g.idx.length} itens` : ""}</span>
                {g.ctx && <p className="ctx">{resumo(d.contextos[g.ctx] ?? "")}</p>}
              </div>
            )}
            {g.idx.map((i) => (
              <Linha key={i} i={i} d={d} aberto={editando === i} setAberto={(v) => setEditando(v ? i : null)} atualizar={atualizar} />
            ))}
          </div>
        ))}
      </div>

      <div className="row">
        <span className="small muted">Adicionar item:</span>
        {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => <button key={t} className="btn sm" type="button" onClick={() => novoItem(t)}>+ {TIPO_LABEL[t]}</button>)}
      </div>

      {erro && <p className="err" role="alert">{erro}</p>}
      <div className="stickybar">
        <div className="row">
          <button className="btn ghost" type="button" onClick={() => router.back()}>Cancelar</button>
          <button className="btn ghost" type="button" onClick={baixar}>Baixar JSON</button>
        </div>
        <button className="btn primary" type="button" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : cadernoId ? "Salvar alterações" : "Publicar caderno"}</button>
      </div>
    </div>
  );
}

function Linha({ i, d, aberto, setAberto, atualizar }: {
  i: number; d: CadernoDados; aberto: boolean; setAberto: (v: boolean) => void; atualizar: (fn: (x: CadernoDados) => void) => void;
}) {
  const q = d.itens[i];
  return (
    <div className={"rv" + (semGab(q) ? " flag" : "")}>
      <span className="num">{q.id}</span>
      <p className="excerpt">{resumo(q.texto)}</p>
      <div className="side">
        <span className="typechip">{q.tipo === "mc" ? `A–${q.opcoes[q.opcoes.length - 1]?.key ?? ""}` : q.tipo === "ce" ? "C/E" : "disc."}</span>
        {q.tipo === "open" ? (
          <span className="small muted">{q.resposta_texto ? "com resposta" : "sem resposta"}</span>
        ) : (
          <select aria-label={`Resposta do item ${q.id}`} id={"ans-" + i} value={q.resposta ?? ""} onChange={(e) => atualizar((x) => { x.itens[i].resposta = e.target.value || null; })}>
            <option value="">Sem gabarito</option>
            {q.opcoes.map((o) => <option key={o.key} value={o.key}>{q.tipo === "ce" ? (o.key === "C" ? "Certo" : "Errado") : `Resposta ${o.key}`}</option>)}
            <option value="X">Anulada</option>
          </select>
        )}
        <button className="btn sm" type="button" onClick={() => setAberto(!aberto)}>{aberto ? "Fechar" : "Editar"}</button>
        <button className="btn ghost sm" type="button" aria-label={`Remover item ${q.id}`} onClick={() => { atualizar((x) => { x.itens.splice(i, 1); }); setAberto(false); }}>Remover</button>
      </div>
      {aberto && <EditorItem key={i} i={i} d={d} fechar={() => setAberto(false)} atualizar={atualizar} />}
    </div>
  );
}

function EditorItem({ i, d, fechar, atualizar }: { i: number; d: CadernoDados; fechar: () => void; atualizar: (fn: (x: CadernoDados) => void) => void }) {
  const q = d.itens[i];
  const [tipo, setTipo] = useState<Tipo>(q.tipo);
  const [texto, setTexto] = useState(q.texto);
  const [id, setId] = useState(q.id);
  const [grupo, setGrupo] = useState(q.grupo);
  const [ctxChave, setCtxChave] = useState(q.ctx ?? "");
  const [ctxTexto, setCtxTexto] = useState(q.ctx ? d.contextos[q.ctx] ?? "" : "");
  const [opcoes, setOpcoes] = useState(q.opcoes.filter(() => q.tipo === "mc").map((o) => `${o.key}) ${o.text}`).join("\n"));
  const [respTexto, setRespTexto] = useState(q.resposta_texto ?? "");

  function aplicar() {
    atualizar((x) => {
      const it = x.itens[i];
      it.texto = texto.trim() || it.texto;
      it.id = id.trim() || it.id;
      it.grupo = grupo.trim() || it.id;
      // enunciado compartilhado: vazio remove o vínculo; o texto vale para todos os itens com a mesma chave
      const chave = ctxChave.trim();
      if (chave && ctxTexto.trim()) { x.contextos[chave] = ctxTexto.trim(); it.ctx = chave; }
      else it.ctx = null;
      if (tipo === "mc") {
        const lista = opcoes.split("\n").map((l) => l.trim()).filter(Boolean).map((l, j) => {
          const m = l.match(/^\(?([A-Ja-j])\s*[).\-–:]\s*(.*)$/);
          return m ? { key: m[1].toUpperCase(), text: m[2] } : { key: ALPHA[j], text: l };
        });
        it.opcoes = new Set(lista.map((o) => o.key)).size === lista.length ? lista : lista.map((o, j) => ({ ...o, key: ALPHA[j] }));
        if (it.tipo !== "mc" || (it.resposta && it.resposta !== "X" && !it.opcoes.some((o) => o.key === it.resposta))) it.resposta = it.resposta === "X" ? "X" : null;
        it.resposta_texto = null;
      } else if (tipo === "ce") {
        if (it.tipo !== "ce") it.resposta = null;
        it.opcoes = CE();
        it.resposta_texto = null;
      } else {
        it.opcoes = []; it.resposta = null; it.resposta_texto = respTexto.trim() || null;
      }
      it.tipo = tipo;
    });
    fechar();
  }

  return (
    <div className="editor">
      <div className="row">
        <label className="field"><span>Tipo</span>
          <select className="inp" id={`tipo-${i}`} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="field"><span>Questão</span><input className="inp" id={`grupo-${i}`} value={grupo} onChange={(e) => setGrupo(e.target.value)} style={{ width: "6rem" }} /></label>
        <label className="field"><span>Item</span><input className="inp" id={`id-${i}`} value={id} onChange={(e) => setId(e.target.value)} style={{ width: "6rem" }} /></label>
      </div>
      <details className="help" open={!!ctxChave}>
        <summary>Enunciado compartilhado {ctxChave ? `(“${ctxChave}”)` : "(opcional)"}</summary>
        <div className="stack">
          <label className="field"><span>Chave</span>
            <input className="inp" id={`ctxk-${i}`} value={ctxChave} placeholder={`ex.: ${grupo}`} style={{ width: "8rem" }}
              onChange={(e) => { const k = e.target.value; setCtxChave(k); if (d.contextos[k.trim()]) setCtxTexto(d.contextos[k.trim()]); }} />
          </label>
          <label className="field"><span>Texto do enunciado</span>
            <textarea className="inp" id={`ctxt-${i}`} rows={5} value={ctxTexto} onChange={(e) => setCtxTexto(e.target.value)} />
          </label>
          <span className="small muted">Itens com a mesma chave mostram o mesmo enunciado. Alterar o texto muda para todos eles.</span>
        </div>
      </details>
      <label className="field"><span>Texto do item</span><textarea className="inp" id={`texto-${i}`} rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
      {tipo === "mc" && (
        <label className="field"><span>Alternativas (uma por linha: A) texto)</span>
          <textarea className="inp" id={`opcoes-${i}`} rows={5} value={opcoes} onChange={(e) => setOpcoes(e.target.value)} />
        </label>
      )}
      {tipo === "open" && (
        <label className="field"><span>Resposta esperada</span>
          <textarea className="inp" id={`resp-${i}`} rows={3} value={respTexto} onChange={(e) => setRespTexto(e.target.value)} />
        </label>
      )}
      <p className="small muted">Dica: **negrito**, linha em branco separa parágrafos e tabelas no formato | a | b | aparecem formatadas.</p>
      <div className="row">
        <button className="btn primary sm" type="button" onClick={aplicar}>Aplicar</button>
        <button className="btn sm" type="button" onClick={fechar}>Cancelar</button>
      </div>
    </div>
  );
}
