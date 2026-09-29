import Link from "next/link";
import Header from "@/components/Header";
import Vincular from "@/components/Vincular";
import { sessao } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar na turma · Caderno de Questões" };

// Link de convite: /vincular?codigo=K7PX2M
export default async function VincularPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo = "" } = await searchParams;
  const { perfil } = await sessao();
  return (
    <>
      <Header perfil={perfil} />
      <main className="wrap stack-lg" style={{ maxWidth: 640 }}>
        <h1>Entrar na turma</h1>
        {perfil.papel === "tutor" ? (
          <>
            <p className="muted">Você é tutor — este link é para os seus alunos. O seu código fica na tela Desempenho.</p>
            <div><Link className="btn" href="/tutor/desempenho">Ir para Desempenho</Link></div>
          </>
        ) : (
          <>
            <p className="muted">Com o código do tutor você passa a ver os cadernos que ele publica, e ele acompanha suas notas.</p>
            <Vincular codigoInicial={codigo.toUpperCase().slice(0, 6)} trocar={!!perfil.tutorId} />
          </>
        )}
      </main>
    </>
  );
}
