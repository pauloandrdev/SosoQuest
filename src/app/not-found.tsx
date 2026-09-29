import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth" style={{ textAlign: "center" }}>
      <h1>Não encontrado</h1>
      <p className="muted">Esse caderno não existe ou foi apagado.</p>
      <Link className="btn primary" href="/" style={{ justifySelf: "center" }}>Voltar aos cadernos</Link>
    </main>
  );
}
