/** Caminho interno seguro para voltar depois do login (evita redirecionar para outro site). */
export function destino(v: string | null | undefined, padrao = "/") {
  if (!v || !v.startsWith("/")) return padrao;
  // O navegador ignora tab/quebra de linha em URLs ("/\t/site.com" vira "//site.com") e trata "\" como "/".
  if (/[\u0000-\u001f\u007f\\\s]/.test(v) || v.startsWith("//")) return padrao;
  // Confirmação final: resolvido contra uma origem qualquer, precisa continuar na mesma origem.
  const base = "http://x.invalid";
  return new URL(v, base).origin === base ? v : padrao;
}
