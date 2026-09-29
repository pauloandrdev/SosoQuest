"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function traduz(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered|already exists/i.test(msg)) return "Já existe uma conta com esse e-mail. Use Entrar.";
  if (/password should be at least/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/signups not allowed|signup is disabled/i.test(msg)) return "O cadastro está fechado. Peça ao tutor para criar sua conta.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
  return msg;
}

export default function LoginForm({ next = "/", linkInvalido = false }: { next?: string; linkInvalido?: boolean }) {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar" | "recuperar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(linkInvalido ? "O link do e-mail expirou ou já foi usado. Peça um novo." : "");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const callback = (destino: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`;
  const trocar = (m: typeof modo) => { setModo(m); setErro(""); setOk(""); };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOk(""); setOcupado(true);
    const supabase = createClient();
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else if (modo === "recuperar") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/nova-senha") });
        if (error) throw error;
        setOk("Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome: nome.trim() }, emailRedirectTo: callback(next) },
        });
        if (error) throw error;
        if (data.session) { router.replace(next); router.refresh(); }
        else setOk("Conta criada. Abra o e-mail que enviamos e clique no link para confirmar; depois é só entrar.");
      }
    } catch (err) {
      setErro(traduz(err instanceof Error ? err.message : String(err)));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="card" onSubmit={enviar}>
      {modo === "recuperar" ? (
        <div className="stack" style={{ gap: 4 }}>
          <h2>Recuperar senha</h2>
          <p className="small muted">Informe seu e-mail. Enviaremos um link para você criar uma senha nova.</p>
        </div>
      ) : (
        <div className="seg" role="group" aria-label="Entrar ou criar conta">
          <button type="button" aria-pressed={modo === "entrar"} onClick={() => trocar("entrar")}>Entrar</button>
          <button type="button" aria-pressed={modo === "criar"} onClick={() => trocar("criar")}>Criar conta</button>
        </div>
      )}
      {modo === "criar" && (
        <label className="field">
          <span>Seu nome</span>
          <input className="inp" id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
        </label>
      )}
      <label className="field">
        <span>E-mail</span>
        <input className="inp" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      {modo !== "recuperar" && (
        <label className="field">
          <span>Senha</span>
          <input className="inp" id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6}
            autoComplete={modo === "entrar" ? "current-password" : "new-password"} />
        </label>
      )}
      {erro && <p className="err" role="alert">{erro}</p>}
      {ok && <p className="okmsg" role="status">{ok}</p>}
      <button className="btn primary" type="submit" disabled={ocupado}>
        {ocupado ? "Aguarde…" : { entrar: "Entrar", criar: "Criar conta", recuperar: "Enviar link" }[modo]}
      </button>
      {modo === "entrar" && <button className="btn ghost" type="button" onClick={() => trocar("recuperar")}>Esqueci minha senha</button>}
      {modo === "recuperar" && <button className="btn ghost" type="button" onClick={() => trocar("entrar")}>← Voltar para entrar</button>}
      {modo === "criar" && <p className="small muted">Toda conta nova começa como aluno. Depois de entrar, use o código de convite do seu tutor.</p>}
    </form>
  );
}
