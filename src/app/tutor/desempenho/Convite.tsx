"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Código e link de convite do tutor, com copiar e gerar outro. */
export default function Convite({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [origem, setOrigem] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => setOrigem(window.location.origin), []);
  const link = `${origem}/vincular?codigo=${codigo}`;

  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch {}
  }
  async function novo() {
    if (!confirm("Gerar um código novo? O código e o link atuais param de funcionar (quem já entrou continua na turma).")) return;
    setOcupado(true);
    await createClient().rpc("meu_codigo_convite", { p_novo: true });
    setOcupado(false);
    router.refresh();
  }

  return (
    <section className="stack">
      <h2>Convide seus alunos</h2>
      <p className="muted">Mande o link (ou o código) para o aluno. Depois de criar a conta, ele entra na sua turma e passa a ver os seus cadernos.</p>
      <div className="stats">
        <div className="stat"><span className="label">Código</span><b className="mono" style={{ letterSpacing: "0.15em" }}>{codigo}</b></div>
      </div>
      <input className="inp mono" readOnly value={link} aria-label="Link de convite" onFocus={(e) => e.target.select()} />
      <div className="row">
        <button className="btn primary" type="button" onClick={copiar}>{copiado ? "Copiado!" : "Copiar link"}</button>
        <button className="btn ghost" type="button" onClick={novo} disabled={ocupado}>Gerar outro código</button>
      </div>
    </section>
  );
}
