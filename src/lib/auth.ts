import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Papel = "aluno" | "tutor";
export type Perfil = { id: string; nome: string; papel: Papel; email: string };

/** Usuário logado + perfil. Redireciona para /login se não houver sessão. */
export async function sessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("id, nome, papel").eq("id", user.id).maybeSingle();
  const perfil: Perfil = {
    id: user.id,
    nome: data?.nome || user.email?.split("@")[0] || "Você",
    papel: data?.papel === "tutor" ? "tutor" : "aluno",
    email: user.email ?? "",
  };
  return { supabase, perfil };
}

/** Igual a sessao(), mas só deixa passar tutor. */
export async function sessaoTutor() {
  const s = await sessao();
  if (s.perfil.papel !== "tutor") redirect("/");
  return s;
}
