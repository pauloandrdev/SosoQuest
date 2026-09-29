import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth">
      <div className="card" style={{ justifyItems: "center", textAlign: "center", padding: 36 }}>
        <div className="bubbles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <span className="label">Erro 404</span>
        <h1 style={{ fontSize: "1.8rem" }}>Página não encontrada</h1>
        <p className="muted">Esse caderno não existe, foi apagado ou você não tem acesso a ele.</p>
        <Link className="btn primary" href="/" style={{ justifySelf: "center" }}>Voltar aos cadernos</Link>
      </div>
    </main>
  );
}
