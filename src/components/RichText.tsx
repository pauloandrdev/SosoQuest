import { Fragment, type ReactNode } from "react";

/* Parágrafos, quebras de linha, **negrito**, tabelas markdown e [figura]. */
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[figura\]/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(m[1] != null ? <strong key={k++}>{m[1]}</strong> : <span key={k++} className="fig">figura no material original</span>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export default function RichText({ text, className = "rt" }: { text: string | null | undefined; className?: string }) {
  const blocos = String(text || "").replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocos.map((b, bi) => {
        const linhas = b.split("\n").filter((l) => l.trim() !== "");
        if (!linhas.length) return null;
        if (linhas.length >= 2 && linhas.every((l) => /^\s*\|.*\|\s*$/.test(l))) {
          const rows = linhas
            .filter((l) => !/^\s*\|[\s:\-|]+\|\s*$/.test(l))
            .map((l) => l.trim().slice(1, -1).split("|").map((c) => c.trim()));
          return (
            <div className="tablewrap" key={bi}>
              <table>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri}>{r.map((c, ci) => (ri === 0 ? <th key={ci}>{inline(c)}</th> : <td key={ci}>{inline(c)}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={bi}>
            {linhas.map((l, li) => (
              <Fragment key={li}>{li > 0 && <br />}{inline(l)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
