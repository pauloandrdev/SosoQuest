import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { destino } from "@/lib/destino";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Entrar · Caderno de Questões" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  const next = destino(sp.next);
  // Sessão confirmada no servidor: já está logado, segue direto.
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (user) redirect(next);
  return (
    <main className="auth">
      <div className="stack" style={{ justifyItems: "center", textAlign: "center" }}>
        <span className="brand-mark" aria-hidden="true" style={{ display: "flex", gap: 4 }}>
          <i /><i className="f" /><i /><i />
        </span>
        <h1>Caderno de Questões</h1>
        <p className="muted">Entre para ver seus cadernos e suas notas.</p>
      </div>
      <LoginForm next={next} linkInvalido={sp.erro === "link"} />
    </main>
  );
}
