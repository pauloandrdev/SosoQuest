import NovaSenhaForm from "./NovaSenhaForm";

export const metadata = { title: "Nova senha · Caderno de Questões" };

// Chega aqui pelo link de "Esqueci minha senha" (o /auth/callback já abriu a sessão).
export default function NovaSenhaPage() {
  return (
    <main className="auth">
      <div className="stack" style={{ justifyItems: "center", textAlign: "center" }}>
        <h1>Nova senha</h1>
        <p className="muted">Escolha a senha que você vai usar para entrar.</p>
      </div>
      <NovaSenhaForm />
    </main>
  );
}
