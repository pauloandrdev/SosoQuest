/** Caminho interno seguro para voltar depois do login (evita redirecionar para outro site). */
export function destino(v: string | null | undefined, padrao = "/") {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : padrao;
}
