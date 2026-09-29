/** Prompt para gerar o JSON de um caderno no chat do Claude (ou outra IA) a partir do PDF. */
export const PROMPT_JSON = `Converta o PDF anexo (prova ou lista de exercícios, com gabarito) em JSON para meu app de estudo.
Responda APENAS com o JSON, sem comentários, neste formato:

{
  "titulo": "nome do caderno",
  "contextos": { "4": "enunciado/caso/texto-base compartilhado por vários itens" },
  "itens": [
    { "id": "1.1", "grupo": "1", "tipo": "ce", "texto": "afirmação", "resposta": "C" },
    { "id": "2", "grupo": "2", "tipo": "mc", "texto": "enunciado", "opcoes": { "A": "...", "B": "...", "C": "...", "D": "..." }, "resposta": "B" },
    { "id": "3", "grupo": "3", "tipo": "discursiva", "texto": "pergunta", "resposta_texto": "resposta esperada" },
    { "id": "4.1", "grupo": "4", "ctx": "4", "tipo": "ce", "texto": "afirmação sobre o caso", "resposta": "E" }
  ]
}

Regras:
- Cada coisa que o aluno responde é UM item: cada afirmação de Certo/Errado, cada subitem com resposta própria, cada questão de múltipla escolha, cada pergunta discursiva.
- "grupo" é o número da questão principal. "id" é único: use a numeração do material (ex.: "4.2"); se os subitens não tiverem número, numere "4.1", "4.2"... na ordem.
- Enunciado, caso ou texto-base usado por vários itens vai UMA vez em "contextos", e os itens apontam para ele em "ctx". O enunciado não é um item.
- "tipo": "mc" (alternativas), "ce" (certo/errado) ou "discursiva".
- "resposta": letra certa ("mc"), "C" ou "E" ("ce"), "X" se anulada, ou null se o gabarito não disser.
- Use o gabarito para as respostas, associando cada resposta ao item certo, na ordem. Não invente respostas.
- Junte linhas quebradas no meio de frases; separe parágrafos com linha em branco; tabelas em markdown (| a | b |); figura que não dá para transcrever vira [figura].
- Ignore cabeçalhos, rodapés e números de página.`;
