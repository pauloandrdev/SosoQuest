"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

/* CAPTCHA do Cloudflare Turnstile. Só aparece se NEXT_PUBLIC_TURNSTILE_SITE_KEY existir. */

type Api = {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: Api }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

/** O token vale para uma única tentativa: mude `renovar` para gerar outro. */
export default function Turnstile({ onToken, renovar = 0 }: { onToken: (token: string) => void; renovar?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const aviso = useRef(onToken);
  aviso.current = onToken;
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !pronto || !caixa.current || !window.turnstile) return;
    aviso.current("");
    const id = window.turnstile.render(caixa.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "auto",
      language: "pt-br",
      callback: (t: string) => aviso.current(t),
      "expired-callback": () => aviso.current(""),
      "error-callback": () => aviso.current(""),
    });
    return () => window.turnstile?.remove(id);
  }, [pronto, renovar]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setPronto(true)} />
      <div ref={caixa} style={{ minHeight: 65 }} />
    </>
  );
}
