import LoginForm from "./LoginForm";
import { destino } from "@/lib/destino";

export const metadata = { title: "Entrar · Caderno de Questões" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="auth">
      <div className="stack" style={{ justifyItems: "center", textAlign: "center" }}>
        <span className="brand-mark" aria-hidden="true" style={{ display: "flex", gap: 4 }}>
          <i /><i className="f" /><i /><i />
        </span>
        <h1>Caderno de Questões</h1>
        <p className="muted">Entre para ver seus cadernos e suas notas.</p>
      </div>
      <LoginForm next={destino(sp.next)} linkInvalido={sp.erro === "link"} />
    </main>
  );
}
