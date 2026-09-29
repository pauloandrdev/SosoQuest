"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icone from "@/components/Icone";

export default function StartPanel({ id, erradas, temDiscursiva }: { id: string; erradas: string[]; temDiscursiva: boolean }) {
  const router = useRouter();
  const [modo, setModo] = useState<"estudo" | "simulado">("estudo");
  const [embaralhar, setEmbaralhar] = useState(false);
  const ir = (so?: string[]) => {
    const q = new URLSearchParams({ modo });
    if (embaralhar) q.set("embaralhar", "1");
    if (so?.length) q.set("so", so.join(","));
    router.push(`/caderno/${id}/responder?${q}`);
  };
  return (
    <section className="card startcard" aria-label="Começar">
      <span className="label">Como você quer responder?</span>
      <div className="modes">
        <label className="mode">
          <input type="radio" name="modo" id="modo-estudo" checked={modo === "estudo"} onChange={() => setModo("estudo")} />
          <span className="mico"><Icone nome="lampada" /></span>
          <b>Estudo</b>
          <span className="small muted">Mostra se acertou logo depois de marcar cada item.</span>
        </label>
        <label className="mode">
          <input type="radio" name="modo" id="modo-simulado" checked={modo === "simulado"} onChange={() => setModo("simulado")} />
          <span className="mico"><Icone nome="cronometro" /></span>
          <b>Simulado</b>
          <span className="small muted">Como na prova: a correção só aparece quando você entrega.</span>
        </label>
      </div>
      {temDiscursiva && <p className="note">Nas discursivas você escreve sua resposta, vê a resposta do gabarito e marca se acertou.</p>}
      <label className="check">
        <input type="checkbox" id="embaralhar" checked={embaralhar} onChange={(e) => setEmbaralhar(e.target.checked)} />
        Embaralhar a ordem das questões
      </label>
      <div className="row">
        <button className="btn primary lg" type="button" onClick={() => ir()}>Começar <Icone nome="seta" /></button>
        {erradas.length > 0 && (
          <button className="btn lg" type="button" onClick={() => ir(erradas)}><Icone nome="repetir" />Refazer as {erradas.length} que errei</button>
        )}
      </div>
    </section>
  );
}
