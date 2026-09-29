import Header from "@/components/Header";
import { sessaoTutor } from "@/lib/auth";
import Importar from "./Importar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo caderno · Caderno de Questões" };

export default async function NovoPage() {
  const { perfil } = await sessaoTutor();
  return (
    <>
      <Header perfil={perfil} atual="novo" />
      <main className="wrap stack-lg" style={{ maxWidth: 900 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1>Novo caderno</h1>
          <p className="muted">Envie um arquivo JSON com as questões e o gabarito, ou monte o caderno direto na tela. Antes de publicar, você revisa tudo.</p>
        </div>
        <Importar />
      </main>
    </>
  );
}
