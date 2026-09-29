"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ApagarCaderno({ id }: { id: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState("");
  if (!confirmar)
    return <button className="btn ghost" type="button" style={{ color: "var(--bad)" }} onClick={() => setConfirmar(true)}>Apagar caderno</button>;
  return (
    <div className="confirm">
      <span>Apagar este caderno e todas as notas dele?</span>
      <button className="btn danger" type="button" onClick={async () => {
        const { error } = await createClient().from("cadernos").delete().eq("id", id);
        if (error) { setErro("Não foi possível apagar. Tente de novo."); return; }
        router.replace("/"); router.refresh();
      }}>Apagar</button>
      <button className="btn" type="button" onClick={() => setConfirmar(false)}>Cancelar</button>
      {erro && <span className="small" style={{ color: "var(--bad)" }}>{erro}</span>}
    </div>
  );
}
