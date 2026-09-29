"use client";
import { useState } from "react";
import Editor from "@/components/Editor";
import Icone from "@/components/Icone";
import { importar, type CadernoDados } from "@/lib/caderno";
import { PROMPT_JSON } from "@/lib/prompt";

export default function Importar() {
  const [dados, setDados] = useState<CadernoDados | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [colado, setColado] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function processar(texto: string, nome = "") {
    setErros([]); setAvisos([]);
    let raw: unknown;
    try {
      raw = JSON.parse(texto.replace(/^﻿/, "").replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
    } catch (e) {
      setErros([`O conteúdo não é um JSON válido: ${e instanceof Error ? e.message : e}`]);
      return;
    }
    const r = importar(raw, nome.replace(/\.json$/i, "").replace(/[_-]+/g, " "));
    setErros(r.erros); setAvisos(r.avisos);
    if (r.dados) setDados(r.dados);
  }
  async function lerArquivo(f?: File | null) {
    if (!f) return;
    processar(await f.text(), f.name);
  }

  if (dados) return <Editor inicial={dados} avisos={avisos} />;

  return (
    <div className="stack-lg">
      <label className={"drop" + (arrastando ? " over" : "")} htmlFor="arquivo"
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); lerArquivo(e.dataTransfer.files[0]); }}>
        <Icone nome="enviar" tamanho={30} />
        <b style={{ fontSize: "1.05rem" }}>Enviar arquivo JSON</b>
        <span className="muted">Toque para escolher ou arraste o arquivo <b>.json</b> aqui</span>
        <input id="arquivo" type="file" accept="application/json,.json" onChange={(e) => lerArquivo(e.target.files?.[0])} />
      </label>

      <details className="help">
        <summary>Ou cole o JSON</summary>
        <div className="stack">
          <textarea className="inp" id="colado" rows={8} value={colado} onChange={(e) => setColado(e.target.value)} placeholder='{"titulo": "...", "itens": [...]}' style={{ fontFamily: "var(--f-mono)", fontSize: ".85rem" }} />
          <div><button className="btn" type="button" disabled={!colado.trim()} onClick={() => processar(colado)}>Ler JSON colado</button></div>
        </div>
      </details>

      {erros.length > 0 && <div className="err" role="alert">{erros.map((e, i) => <p key={i}>{e}</p>)}</div>}

      <div className="row">
        <span className="muted">Sem arquivo?</span>
        <button className="btn" type="button" onClick={() => setDados({ titulo: "", descricao: "", contextos: {}, itens: [] })}>Montar do zero</button>
        <a className="btn ghost" href="/exemplo-caderno.json" download>Baixar exemplo</a>
      </div>

      <section className="card stack">
        <h2>Como gerar o JSON a partir de um PDF</h2>
        <p>Abra o chat do Claude (ou outra IA que você já usa), anexe o PDF da prova com o gabarito e cole o texto abaixo. Salve a resposta como <code>.json</code> e envie aqui, ou cole direto no campo acima.</p>
        <pre className="code">{PROMPT_JSON}</pre>
        <div>
          <button className="btn" type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(PROMPT_JSON); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão de área de transferência */ }
          }}>{copiado ? "Copiado" : "Copiar prompt"}</button>
        </div>
      </section>

      <section className="card stack">
        <h2>Formato do arquivo</h2>
        <ul className="stack" style={{ margin: 0, paddingLeft: 18, gap: 6 }}>
          <li><code>itens</code> — lista obrigatória. Cada item tem <code>id</code>, <code>grupo</code>, <code>tipo</code> e <code>texto</code>.</li>
          <li><code>tipo</code> — <code>mc</code> (múltipla escolha), <code>ce</code> (certo/errado) ou <code>discursiva</code>.</li>
          <li><code>opcoes</code> — só em <code>mc</code>: <code>{"{\"A\": \"...\", \"B\": \"...\"}"}</code> ou lista <code>[&quot;A) ...&quot;, &quot;B) ...&quot;]</code>.</li>
          <li><code>resposta</code> — letra (<code>mc</code>), <code>C</code>/<code>E</code> (<code>ce</code>), <code>X</code> para anulada. <code>resposta_texto</code> nas discursivas.</li>
          <li><code>contextos</code> + <code>ctx</code> — enunciado compartilhado por vários itens (um caso, um texto-base).</li>
        </ul>
      </section>
    </div>
  );
}
