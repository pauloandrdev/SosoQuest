/* Modelo de dados do caderno, importação de JSON e correção. */

export type Tipo = "mc" | "ce" | "open";
export type Opcao = { key: string; text: string };
export type Item = {
  id: string;            // rótulo do item, ex.: "4.2"
  grupo: string;         // número da questão principal, ex.: "4"
  ctx: string | null;    // chave em contextos (enunciado compartilhado)
  tipo: Tipo;
  texto: string;
  opcoes: Opcao[];
  resposta: string | null;        // "A".."J" (mc), "C"/"E" (ce), "X" = anulada
  resposta_texto: string | null;  // resposta esperada das discursivas
};
export type CadernoDados = {
  titulo: string;
  descricao: string;
  contextos: Record<string, string>;
  itens: Item[];
};
export type Caderno = CadernoDados & { id: string; criado_em: string; atualizado_em: string };
/** Item como chega para quem responde: sem as respostas. "gabarito" diz se o item conta na nota. */
export type ItemAberto = Omit<Item, "resposta" | "resposta_texto"> & { gabarito: boolean };
export type Gabarito = { resposta: string | null; resposta_texto: string | null };
/** Resultado de cada item numa tentativa, calculado pelo banco. */
export type StatusItem = "ok" | "bad" | "blank" | "void";

export const TIPO_LABEL: Record<Tipo, string> = { mc: "Múltipla escolha", ce: "Certo/Errado", open: "Discursiva" };
export const ALPHA = "ABCDEFGHIJ";
export const CE = (): Opcao[] => [
  { key: "C", text: "Certo" },
  { key: "E", text: "Errado" },
];

/* ---------------- correção ---------------- */

export function temGabarito(q: Item) {
  if (q.tipo === "open") return true; // discursiva: o próprio aluno marca se acertou
  return !!q.resposta && q.resposta !== "X" && q.opcoes.some((o) => o.key === q.resposta);
}
export function acertou(q: Item, r: string | undefined) {
  return q.tipo === "open" ? r === "=ok" : r === q.resposta;
}
export type Placar = { acertos: number; erros: number; brancos: number; sem_gabarito: number; total: number };
export function corrigir(itens: Item[], respostas: Record<string, string>): Placar {
  const p: Placar = { acertos: 0, erros: 0, brancos: 0, sem_gabarito: 0, total: itens.length };
  for (const q of itens) {
    const r = respostas[q.id];
    if (!temGabarito(q)) p.sem_gabarito++;
    else if (!r) p.brancos++;
    else if (acertou(q, r)) p.acertos++;
    else p.erros++;
  }
  return p;
}
export const rotulo = (q: Pick<Item, "id" | "grupo">) => (q.id === q.grupo ? `Questão ${q.grupo}` : `Questão ${q.grupo} · item ${q.id}`);

/* ---------------- importação ---------------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (v == null ? "" : String(v)).trim();
const pick = (o: Obj, ...keys: string[]) => {
  for (const k of keys) if (o[k] != null && o[k] !== "") return o[k];
  return undefined;
};

function tipoDe(v: unknown): Tipo | null {
  const s = str(v).toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  if (["mc", "multipla", "multiplaescolha", "objetiva", "alternativas"].includes(s)) return "mc";
  if (["ce", "certoerrado", "certoouerrado", "vf", "verdadeirofalso"].includes(s)) return "ce";
  if (["open", "discursiva", "aberta", "dissertativa", "escrita"].includes(s)) return "open";
  return null;
}
export function letra(v: unknown): string | null {
  const s = str(v).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!s) return null;
  if (/^ANUL/.test(s) || s === "X" || s === "*") return "X";
  if (s === "CERTO" || s === "CERTA" || s === "V" || s === "VERDADEIRO") return "C";
  if (s === "ERRADO" || s === "ERRADA" || s === "F" || s === "FALSO") return "E";
  return /^[A-J]$/.test(s) ? s : null;
}
function opcoesDe(v: unknown): Opcao[] {
  let out: Opcao[] = [];
  if (Array.isArray(v)) {
    out = v.map((o, i) => {
      if (typeof o === "string") {
        const m = o.match(/^\s*\(?([A-Ja-j])\s*[).\-–:]\s*([\s\S]*)$/);
        return m ? { key: m[1].toUpperCase(), text: m[2].trim() } : { key: ALPHA[i], text: o.trim() };
      }
      if (isObj(o)) return { key: str(pick(o, "key", "letra", "chave") ?? ALPHA[i]).toUpperCase().slice(0, 1) || ALPHA[i], text: str(pick(o, "text", "texto")) };
      return { key: ALPHA[i], text: str(o) };
    });
  } else if (isObj(v)) {
    out = Object.entries(v).map(([k, t]) => ({ key: k.trim().toUpperCase().slice(0, 1), text: str(t) }));
  }
  out = out.filter((o) => o.text);
  if (new Set(out.map((o) => o.key)).size !== out.length) out = out.map((o, i) => ({ ...o, key: ALPHA[i] }));
  return out;
}

export type ResultadoImportacao = { dados: CadernoDados | null; erros: string[]; avisos: string[] };

/**
 * Aceita o formato documentado (itens/contextos em português), o formato antigo
 * do Caderno no Claude (questions/contexts) ou só uma lista de itens.
 */
export function importar(raw: unknown, tituloPadrao = ""): ResultadoImportacao {
  const erros: string[] = [];
  const avisos: string[] = [];
  let root: Obj;
  if (Array.isArray(raw)) root = { itens: raw };
  else if (isObj(raw)) root = raw;
  else return { dados: null, erros: ["O arquivo não é um objeto JSON nem uma lista de itens."], avisos };

  const lista = pick(root, "itens", "questoes", "questions", "items");
  if (!Array.isArray(lista) || !lista.length) return { dados: null, erros: ['Não achei a lista de itens. Ela deve estar em "itens".'], avisos };

  const ctxRaw = pick(root, "contextos", "contexts");
  const contextos: Record<string, string> = {};
  if (isObj(ctxRaw)) for (const [k, v] of Object.entries(ctxRaw)) if (str(v)) contextos[k] = str(v);

  const itens: Item[] = [];
  const vistos = new Map<string, number>();
  lista.forEach((q, i) => {
    const pos = `Item ${i + 1}`;
    if (!isObj(q)) { avisos.push(`${pos}: ignorado (não é um objeto).`); return; }
    const texto = str(pick(q, "texto", "text", "enunciado", "pergunta"));
    if (!texto) { avisos.push(`${pos}: ignorado (sem texto).`); return; }

    let opcoes = opcoesDe(pick(q, "opcoes", "options", "alternativas"));
    let resposta = letra(pick(q, "resposta", "answer", "gabarito"));
    let tipo = tipoDe(pick(q, "tipo", "type"));
    if (!tipo) tipo = opcoes.length >= 2 ? (opcoes.every((o) => o.key === "C" || o.key === "E") && opcoes.length === 2 ? "ce" : "mc") : resposta === "C" || resposta === "E" ? "ce" : "open";

    let resposta_texto: string | null = null;
    if (tipo === "mc" && opcoes.length < 2) {
      avisos.push(`${pos}: marcado como múltipla escolha, mas tem menos de 2 alternativas — virou discursiva.`);
      tipo = "open";
    }
    if (tipo === "ce") {
      opcoes = CE();
      if (resposta && !["C", "E", "X"].includes(resposta)) resposta = null;
    }
    if (tipo === "mc" && resposta && resposta !== "X" && !opcoes.some((o) => o.key === resposta)) {
      avisos.push(`${pos}: a resposta "${resposta}" não está entre as alternativas.`);
      resposta = null;
    }
    if (tipo === "open") {
      opcoes = [];
      const rt = pick(q, "resposta_texto", "answerText", "resposta_esperada");
      const bruto = pick(q, "resposta", "answer");
      resposta_texto = str(rt) || (str(bruto).length > 1 ? str(bruto) : "") || null;
      resposta = null;
    }

    const grupo = str(pick(q, "grupo", "group", "n", "numero")) || String(i + 1);
    let id = str(pick(q, "id", "rotulo")) || grupo;
    const c = vistos.get(id) ?? 0;
    if (c) { avisos.push(`${pos}: número "${id}" repetido — renomeado para "${id}-${c + 1}".`); id = `${id}-${c + 1}`; }
    vistos.set(str(pick(q, "id", "rotulo")) || grupo, c + 1);

    let ctx = str(pick(q, "ctx", "contexto")) || null;
    if (ctx && !contextos[ctx]) { avisos.push(`${pos}: enunciado "${ctx}" não existe em "contextos" — removido.`); ctx = null; }

    itens.push({ id, grupo, ctx, tipo, texto, opcoes, resposta, resposta_texto });
  });

  if (!itens.length) erros.push("Nenhum item válido no arquivo.");
  const semGab = itens.filter((q) => q.tipo !== "open" && !q.resposta).length;
  if (semGab) avisos.push(`${semGab} ${semGab === 1 ? "item está" : "itens estão"} sem gabarito (não contam na nota até você preencher).`);

  const titulo = str(pick(root, "titulo", "title")) || tituloPadrao || "Caderno sem título";
  const descricao = str(pick(root, "descricao", "description"));
  return { dados: itens.length ? { titulo, descricao, contextos, itens } : null, erros, avisos };
}

/** Deixa só os enunciados usados e remove campos sobrando antes de salvar. */
export function limpar(d: CadernoDados): CadernoDados {
  const usados = new Set(d.itens.map((q) => q.ctx).filter(Boolean) as string[]);
  const contextos: Record<string, string> = {};
  for (const k of usados) if (d.contextos[k]?.trim()) contextos[k] = d.contextos[k].trim();
  return {
    titulo: d.titulo.trim() || "Caderno sem título",
    descricao: d.descricao.trim(),
    contextos,
    itens: d.itens.map((q) => ({
      id: q.id.trim(), grupo: q.grupo.trim() || q.id.trim(), ctx: q.ctx && contextos[q.ctx] ? q.ctx : null,
      tipo: q.tipo, texto: q.texto.trim(), opcoes: q.tipo === "open" ? [] : q.opcoes,
      resposta: q.tipo === "open" ? null : q.resposta, resposta_texto: q.tipo === "open" ? q.resposta_texto?.trim() || null : null,
    })),
  };
}

/** Converte para o formato de arquivo documentado (para baixar/backup). */
export function paraJson(d: CadernoDados) {
  return {
    titulo: d.titulo,
    descricao: d.descricao || undefined,
    contextos: d.contextos,
    itens: d.itens.map((q) => ({
      id: q.id, grupo: q.grupo, ctx: q.ctx ?? undefined, tipo: q.tipo === "open" ? "discursiva" : q.tipo, texto: q.texto,
      opcoes: q.tipo === "mc" ? Object.fromEntries(q.opcoes.map((o) => [o.key, o.text])) : undefined,
      resposta: q.tipo === "open" ? undefined : q.resposta ?? undefined,
      resposta_texto: q.tipo === "open" ? q.resposta_texto ?? undefined : undefined,
    })),
  };
}
