"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NovaSenhaForm() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha !== repetir) { setErro("As duas senhas não são iguais."); return; }
    setOcupado(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) {
      setErro(/should be different/i.test(error.message) ? "A senha nova precisa ser diferente da antiga."
        : /at least/i.test(error.message) ? "A senha precisa ter pelo menos 6 caracteres."
        : "Não foi possível trocar a senha. Peça um novo link e tente de novo.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="card" onSubmit={enviar}>
      <label className="field">
        <span>Senha nova</span>
        <input className="inp" id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoComplete="new-password" />
      </label>
      <label className="field">
        <span>Repita a senha</span>
        <input className="inp" id="repetir" type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required minLength={6} autoComplete="new-password" />
      </label>
      {erro && <p className="err" role="alert">{erro}</p>}
      <button className="btn primary" type="submit" disabled={ocupado}>{ocupado ? "Aguarde…" : "Salvar senha"}</button>
    </form>
  );
}
