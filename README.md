# Caderno de Questões

Cadernos de questões com gabarito, correção automática e histórico de notas.
Next.js (Vercel) + Supabase (login e banco). 100% no plano gratuito, sem IA no servidor.

- **Aluno:** vê os cadernos, responde (modo Estudo ou Simulado) e acompanha as próprias notas.
- **Tutor:** tudo do aluno + cria cadernos (enviando JSON ou montando na tela), edita, apaga e vê o desempenho de todos os alunos.

Tipos de item: múltipla escolha, Certo/Errado e discursiva (o aluno escreve, vê a resposta do gabarito e marca se acertou). Itens de uma mesma questão podem compartilhar um enunciado (um caso, um texto-base).

---

## 1. Supabase (banco e login)

1. Crie uma conta em https://supabase.com e um projeto novo (região `South America (São Paulo)`).
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / public**.

## 2. Rodar no seu computador

```bash
git clone <seu-repo> caderno-de-questoes
cd caderno-de-questoes
npm install
cp .env.example .env.local   # preencha com a URL e a anon key do passo 1
npm run dev                  # abre em http://localhost:3000
```

## 3. Publicar na Vercel

```bash
npm i -g vercel
vercel login
vercel link                                   # cria o projeto na sua conta
vercel env add NEXT_PUBLIC_SUPABASE_URL       # escolha Production, Preview e Development
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel --prod                                 # mostra a URL final, ex.: https://caderno-xyz.vercel.app
```

Ou pelo site: suba o repositório no GitHub → vercel.com → **Add New Project** → importe o repo → adicione as duas variáveis → **Deploy**.

**Manter o Supabase acordado:** o plano gratuito pausa o projeto depois de 7 dias sem acesso. O `vercel.json` já agenda um Cron diário que chama `/api/manter-ativo` para evitar isso. Opcional: crie a variável `CRON_SECRET` (qualquer texto aleatório longo) na Vercel para que só o Cron consiga chamar essa rota.

## 4. Ajustar o login no Supabase

Em **Authentication → URL Configuration**:

- **Site URL:** a URL da Vercel (ex.: `https://caderno-xyz.vercel.app`)
- **Redirect URLs:** adicione `https://caderno-xyz.vercel.app/**` e `http://localhost:3000/**` (o `/**` no final libera os links de confirmação, recuperação de senha e convite)

Por padrão o Supabase pede confirmação por e-mail no cadastro. O envio de e-mail embutido do plano gratuito tem limite baixo por hora; para uso pessoal você pode desligar **Confirm email** nas configurações do provedor Email em **Authentication**.

Para ninguém de fora criar conta: depois que você e seus alunos se cadastrarem, desligue **Allow new users to sign up** nas configurações de Authentication. Novos alunos podem ser convidados pelo painel (**Authentication → Users → Invite user**).

## 5. Virar tutor

Toda conta nova nasce como **aluno**. Crie a sua conta pelo site e rode no **SQL Editor** (troque o e-mail):

```sql
update public.profiles set papel = 'tutor'
where id = (select id from auth.users where email = 'seu@email.com');
```

## 6. Convidar alunos

Cada aluno vê só os cadernos do seu tutor. Na tela **Desempenho**, o tutor encontra o **código de convite** e o link (`/vincular?codigo=...`). O aluno abre o link (ou digita o código na tela inicial) e entra na turma. **Gerar outro código** invalida o antigo; quem já entrou continua na turma.

## Segurança do gabarito

O gabarito nunca vai inteiro para o navegador do aluno: o app recebe os itens sem as respostas, a resposta de um item só é liberada quando o aluno marca (modo Estudo) ou entrega, e a nota é calculada no banco pela função `entregar`. Por isso o aluno não consegue ver o gabarito antes nem gravar uma nota falsa.

Limites contra abuso (no banco): no máximo 10 entregas por minuto por aluno, provas de até 1000 itens, 10 códigos de convite errados por hora (depois disso, trava por uma hora) e nomes de até 80 caracteres. O app também envia cabeçalhos de segurança (CSP, bloqueio de iframe) configurados no `next.config.ts`. Sempre que atualizar o app, rode o `supabase/schema.sql` de novo (ele pode ser rodado várias vezes sem apagar nada).

Saia e entre de novo: aparecem **Novo caderno** e **Desempenho** no menu.

---

## Criando cadernos

Em **Novo caderno** você pode:

1. **Enviar um arquivo `.json`** (ou colar o conteúdo),
2. **Montar do zero** na tela.

Nos dois casos o caderno passa pelo editor antes de ser publicado, onde dá para corrigir texto, tipo, alternativas, gabarito e enunciados compartilhados. O botão **Baixar JSON** do editor gera um backup.

### Formato do JSON

Veja [`exemplos/exemplo-caderno.json`](exemplos/exemplo-caderno.json).

```json
{
  "titulo": "Direito do Trabalho II — Lista 3",
  "descricao": "opcional",
  "contextos": { "4": "Beta, empregada da Distribuidora Sol Ltda. desde 03.03.2019..." },
  "itens": [
    { "id": "1.1", "grupo": "1", "tipo": "ce", "texto": "A hora noturna é de 52min30s.", "resposta": "C" },
    { "id": "2", "grupo": "2", "tipo": "mc", "texto": "Enunciado...", "opcoes": { "A": "...", "B": "..." }, "resposta": "B" },
    { "id": "3", "grupo": "3", "tipo": "discursiva", "texto": "Pergunta...", "resposta_texto": "Resposta esperada" },
    { "id": "4.1", "grupo": "4", "ctx": "4", "tipo": "ce", "texto": "Afirmação sobre o caso", "resposta": "E" }
  ]
}
```

| Campo | Obrigatório | Valores |
|---|---|---|
| `id` | sim | número do item, único no caderno (`"12"`, `"4.2"`) |
| `grupo` | sim | número da questão principal (`"4"`) |
| `tipo` | sim | `mc`, `ce` ou `discursiva` |
| `texto` | sim | enunciado do item. Aceita `**negrito**`, parágrafos separados por linha em branco e tabelas `\| a \| b \|` |
| `opcoes` | em `mc` | objeto `{"A": "...", "B": "..."}` ou lista `["A) ...", "B) ..."]` |
| `resposta` | em `mc`/`ce` | letra (`mc`), `C` ou `E` (`ce`), `X` = anulada, `null` = sem gabarito |
| `resposta_texto` | em `discursiva` | resposta esperada |
| `ctx` | não | chave em `contextos` para itens que compartilham um enunciado |

### Gerando o JSON a partir de um PDF

Na tela **Novo caderno** há um prompt pronto (botão **Copiar prompt**). Anexe o PDF da prova no chat do Claude (ou outra IA que você já use), cole o prompt e salve a resposta como `.json`. Assim a leitura do PDF usa a sua assinatura e o site continua sem custo.

---

## Estrutura

```
supabase/schema.sql              tabelas, papéis e regras de acesso (RLS)
src/middleware.ts                exige login em todas as páginas
src/lib/caderno.ts               modelo, importação do JSON e correção
src/app/login                    entrar / criar conta
src/app/page.tsx                 dashboard: pontuações e cadernos
src/app/caderno/[id]             página do caderno + histórico
src/app/caderno/[id]/responder   responder e resultado
src/app/caderno/[id]/editar      editor (tutor)
src/app/tutor/novo               importar JSON / montar do zero (tutor)
src/app/tutor/desempenho         notas de todos os alunos (tutor)
```

## Segurança

As regras ficam no banco (Row Level Security), não só na interface:

- Qualquer usuário logado **lê** cadernos; só **tutor** cria, edita e apaga.
- Cada aluno grava e vê **só as próprias** tentativas; o tutor vê todas.
- O usuário só consegue alterar o próprio **nome**; o papel (aluno/tutor) só muda pelo SQL Editor.

## Celular

Abra a URL no navegador do celular e use **Adicionar à tela inicial**: o site abre como app, em tela cheia.
