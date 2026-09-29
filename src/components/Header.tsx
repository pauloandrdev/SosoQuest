import Link from "next/link";
import type { Perfil } from "@/lib/auth";
import Sair from "./Sair";

export default function Header({ perfil, atual }: { perfil: Perfil; atual?: "inicio" | "novo" | "desempenho" }) {
  const cur = (k: string) => (atual === k ? "page" : undefined);
  return (
    <header className="top">
      <Link className="brand" href="/" aria-label="Início">
        <span className="brand-mark" aria-hidden="true"><i /><i className="f" /><i /><i /></span>
        <b>Caderno de Questões</b>
      </Link>
      <nav className="nav" aria-label="Principal">
        <Link href="/" aria-current={cur("inicio")}>Cadernos</Link>
        {perfil.papel === "tutor" && (
          <>
            <Link href="/tutor/novo" aria-current={cur("novo")}>Novo caderno</Link>
            <Link href="/tutor/desempenho" aria-current={cur("desempenho")}>Desempenho</Link>
          </>
        )}
      </nav>
      <div className="who">
        <span>{perfil.nome}</span>
        <span className={"role" + (perfil.papel === "tutor" ? " tutor" : "")}>{perfil.papel}</span>
        <Sair />
      </div>
    </header>
  );
}
