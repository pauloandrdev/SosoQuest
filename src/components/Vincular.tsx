"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Formulário em que o aluno digita o código de convite do tutor. */
export default function Vincular({ codigoInicial = "", trocar = false }: { codigoInicial?: string; trocar?: boolean }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(codigoInicial);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOk(""); setOcupado(true);
    const { data, error } = await createClient().rpc("vincular_tutor", { p_codigo: codigo });
    setOcupado(false);
    if (error) { setErro(error.message || "Não foi possível usar o código."); return; }
    setOk(`Pronto! Você agora está na turma de ${data || "seu tutor"}.`);
    router.push("/");
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={enviar} style={{ maxWidth: 420 }}>
      <label className="field">
        <span>{trocar ? "Trocar de tutor: código de convite" : "Código de convite do tutor"}</span>
        <input className="inp mono" id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          required minLength={6} maxLength={6} autoComplete="off" placeholder="Ex.: K7PX2M" style={{ letterSpacing: "0.2em" }} />
      </label>
      {erro && <p className="err" role="alert">{erro}</p>}
      {ok && <p className="okmsg" role="status">{ok}</p>}
      <div><button className="btn primary" type="submit" disabled={ocupado}>{ocupado ? "Aguarde…" : "Entrar na turma"}</button></div>
    </form>
  );
}
