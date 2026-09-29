-- =====================================================================
-- Caderno de Questões — esquema do banco (Supabase / Postgres)
-- Rode tudo de uma vez no SQL Editor do Supabase.
-- =====================================================================

-- ---------- Perfis: um por usuário, com o papel (aluno ou tutor) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  papel text not null default 'aluno' check (papel in ('aluno', 'tutor')),
  criado_em timestamptz not null default now()
);

-- Cria o perfil automaticamente no cadastro (sempre como aluno).
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Diz se quem está logado é tutor. security definer para não cair em recursão de RLS.
create or replace function public.is_tutor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'tutor' from public.profiles where id = auth.uid()), false);
$$;

-- ---------- Cadernos: itens e enunciados compartilhados em JSON ----------
create table if not exists public.cadernos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null default '',
  contextos jsonb not null default '{}'::jsonb,   -- {"4": "enunciado do caso..."}
  itens jsonb not null default '[]'::jsonb,       -- [{id, grupo, ctx, tipo, texto, opcoes, resposta, resposta_texto}]
  total_itens int generated always as (jsonb_array_length(itens)) stored,
  criado_por uuid references auth.users on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- Tentativas: uma por prova respondida ----------
create table if not exists public.tentativas (
  id uuid primary key default gen_random_uuid(),
  caderno_id uuid not null references public.cadernos on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  modo text not null check (modo in ('estudo', 'simulado')),
  itens jsonb not null,          -- ids dos itens respondidos nesta tentativa
  respostas jsonb not null,      -- {"4.1": "C", "3": "=ok"}
  acertos int not null,
  erros int not null,
  brancos int not null,
  sem_gabarito int not null,
  total int not null,
  segundos int not null,
  feita_em timestamptz not null default now()
);
create index if not exists tentativas_user_idx on public.tentativas (user_id, feita_em desc);
create index if not exists tentativas_caderno_idx on public.tentativas (caderno_id, feita_em desc);

-- ---------- Segurança (RLS) ----------
alter table public.profiles enable row level security;
alter table public.cadernos enable row level security;
alter table public.tentativas enable row level security;

-- Perfis: cada um vê o seu; o tutor vê todos (para o painel de desempenho).
drop policy if exists perfis_ler on public.profiles;
create policy perfis_ler on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_tutor());

-- O usuário só pode mudar o próprio NOME. O papel não pode ser alterado pelo app.
drop policy if exists perfis_editar on public.profiles;
create policy perfis_editar on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (nome) on public.profiles to authenticated;

-- Cadernos: qualquer usuário logado lê; só tutor cria, edita e apaga.
drop policy if exists cadernos_ler on public.cadernos;
create policy cadernos_ler on public.cadernos for select to authenticated using (true);
drop policy if exists cadernos_criar on public.cadernos;
create policy cadernos_criar on public.cadernos for insert to authenticated with check (public.is_tutor());
drop policy if exists cadernos_editar on public.cadernos;
create policy cadernos_editar on public.cadernos for update to authenticated using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists cadernos_apagar on public.cadernos;
create policy cadernos_apagar on public.cadernos for delete to authenticated using (public.is_tutor());

-- Tentativas: cada um grava e vê as próprias; o tutor vê as de todos.
drop policy if exists tentativas_ler on public.tentativas;
create policy tentativas_ler on public.tentativas for select to authenticated
  using (user_id = auth.uid() or public.is_tutor());
drop policy if exists tentativas_criar on public.tentativas;
create policy tentativas_criar on public.tentativas for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists tentativas_apagar on public.tentativas;
create policy tentativas_apagar on public.tentativas for delete to authenticated
  using (public.is_tutor());

-- =====================================================================
-- Depois de criar a SUA conta pelo site, rode isto trocando o e-mail
-- para virar tutor:
--
--   update public.profiles set papel = 'tutor'
--   where id = (select id from auth.users where email = 'seu@email.com');
-- =====================================================================
