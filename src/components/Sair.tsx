"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icone from "./Icone";

export default function Sair() {
  const router = useRouter();
  return (
    <button
      className="btn ghost icon"
      type="button"
      title="Sair"
      aria-label="Sair"
      onClick={async () => {
        await createClient().auth.signOut({ scope: "local" }); // só este aparelho; o celular continua logado
        router.replace("/login");
        router.refresh();
      }}
    >
      <Icone nome="sair" />
    </button>
  );
}
