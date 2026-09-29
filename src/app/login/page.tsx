import LoginForm from "./LoginForm";

export const metadata = { title: "Entrar · Caderno de Questões" };

export default function LoginPage() {
  return (
    <main className="auth">
      <div className="stack" style={{ justifyItems: "center", textAlign: "center" }}>
        <span className="brand-mark" aria-hidden="true" style={{ display: "flex", gap: 4 }}>
          <i /><i className="f" /><i /><i />
        </span>
        <h1>Caderno de Questões</h1>
        <p className="muted">Entre para ver seus cadernos e suas notas.</p>
      </div>
      <LoginForm />
    </main>
  );
}
