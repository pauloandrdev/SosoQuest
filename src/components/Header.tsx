import Link from "next/link";
import type { Perfil } from "@/lib/auth";
import Icone from "./Icone";
import Sair from "./Sair";

const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

export default function Header({ perfil, atual }: { perfil: Perfil; atual?: "inicio" | "novo" | "desempenho" }) {
  const cur = (k: string) => (atual === k ? "page" : undefined);
  return (
    <header className="top">
      <Link className="brand" href="/" aria-label="Início">
        <span className="brand-mark" aria-hidden="true"><i /><i className="f" /><i /><i /></span>
        <b>Caderno de Questões</b>
      </Link>
      <nav className="nav" aria-label="Principal">
        <Link href="/" aria-current={cur("inicio")}><Icone nome="livro" tamanho={16} />Cadernos</Link>
        {perfil.papel === "tutor" && (
          <>
            <Link href="/tutor/novo" aria-current={cur("novo")}><Icone nome="mais" tamanho={16} />Novo caderno</Link>
            <Link href="/tutor/desempenho" aria-current={cur("desempenho")}><Icone nome="grafico" tamanho={16} />Desempenho</Link>
          </>
        )}
      </nav>
      <div className="who">
        <span className="avatar" aria-hidden="true">{iniciais(perfil.nome)}</span>
        <span className="who-t">
          <b title={perfil.nome}>{perfil.nome}</b>
          <span className={"role" + (perfil.papel === "tutor" ? " tutor" : "")}>{perfil.papel}</span>
        </span>
        <Sair />
      </div>
    </header>
  );
}
