"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Sair() {
  const router = useRouter();
  return (
    <button
      className="btn ghost sm"
      type="button"
      onClick={async () => {
        await createClient().auth.signOut({ scope: "local" }); // só este aparelho; o celular continua logado
        router.replace("/login");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
