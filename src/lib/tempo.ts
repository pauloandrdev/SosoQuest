export const pct = (c: number, g: number) => (g ? Math.round((c / g) * 100) : 0);

export const fmtTempo = (s: number) => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

export const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
