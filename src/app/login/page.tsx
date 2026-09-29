import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import Icone from "@/components/Icone";
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
    <main className="auth-split">
      <section className="auth-hero" aria-label="Sobre o Caderno de Questões">
        <div className="row" style={{ gap: 10 }}>
          <span className="brand-mark" aria-hidden="true"><i /><i className="f" /><i /><i /></span>
          <b style={{ font: "800 1.1rem/1 var(--f-display)" }}>Caderno de Questões</b>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          <h1>Treine com as questões do seu tutor.</h1>
          <p>Responda no modo estudo ou simulado, veja a correção na hora e acompanhe sua evolução.</p>
        </div>
        <ul className="feats">
          <li><span className="b"><Icone nome="lampada" tamanho={14} /></span>Modo estudo: descubra se acertou logo depois de marcar.</li>
          <li><span className="b"><Icone nome="cronometro" tamanho={14} /></span>Simulado: como na prova, com tempo e correção no final.</li>
          <li><span className="b"><Icone nome="grafico" tamanho={14} /></span>Histórico de notas e revisão das questões que você errou.</li>
        </ul>
      </section>
      <div className="auth-form">
        <div className="auth-form-head">
          <span className="brand-mark" aria-hidden="true"><i /><i className="f" /><i /><i /></span>
          <h1 style={{ fontSize: "1.6rem" }}>Caderno de Questões</h1>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <h2>Bem-vindo de volta</h2>
          <p className="muted">Entre para ver seus cadernos e suas notas.</p>
        </div>
        <LoginForm next={next} linkInvalido={sp.erro === "link"} />
      </div>
    </main>
  );
}
