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

-- Tutor ao qual o aluno está vinculado. O aluno só vê os cadernos desse tutor.
alter table public.profiles add column if not exists tutor_id uuid references public.profiles on delete set null;
create index if not exists profiles_tutor_idx on public.profiles (tutor_id);

-- Nome com tamanho limitado (o próprio usuário pode editar o nome pela API).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_nome_tamanho') then
    update public.profiles set nome = left(nome, 80) where char_length(nome) > 80;
    alter table public.profiles add constraint profiles_nome_tamanho check (char_length(nome) <= 80);
  end if;
end $$;

-- Cria o perfil automaticamente no cadastro (sempre como aluno).
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)), 80));
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

-- Tutor de quem está logado (null se não tiver).
create or replace function public.meu_tutor()
returns uuid language sql stable security definer set search_path = public as $$
  select tutor_id from public.profiles where id = auth.uid();
$$;

-- Diz se o usuário informado é aluno vinculado a quem está logado.
create or replace function public.eh_meu_aluno(aluno uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = aluno and tutor_id = auth.uid());
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
-- Resultado por item, calculado no banco: {"4.1": "ok" | "bad" | "blank" | "void"}.
alter table public.tentativas add column if not exists resultado jsonb not null default '{}'::jsonb;
create index if not exists tentativas_user_idx on public.tentativas (user_id, feita_em desc);
create index if not exists tentativas_caderno_idx on public.tentativas (caderno_id, feita_em desc);

-- ---------- Segurança (RLS) ----------
alter table public.profiles enable row level security;
alter table public.cadernos enable row level security;
alter table public.tentativas enable row level security;

-- Perfis: cada um vê o seu e o do seu tutor; o tutor vê os dos alunos vinculados.
drop policy if exists perfis_ler on public.profiles;
create policy perfis_ler on public.profiles for select to authenticated
  using (id = auth.uid() or tutor_id = auth.uid() or id = public.meu_tutor());

-- O usuário só pode mudar o próprio NOME. O papel não pode ser alterado pelo app.
drop policy if exists perfis_editar on public.profiles;
create policy perfis_editar on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (nome) on public.profiles to authenticated;

-- Cadernos: o tutor lê e mexe nos que criou; o aluno lê os do seu tutor.
drop policy if exists cadernos_ler on public.cadernos;
create policy cadernos_ler on public.cadernos for select to authenticated
  using (criado_por = auth.uid() or criado_por = public.meu_tutor());
drop policy if exists cadernos_criar on public.cadernos;
create policy cadernos_criar on public.cadernos for insert to authenticated
  with check (public.is_tutor() and criado_por = auth.uid());
drop policy if exists cadernos_editar on public.cadernos;
create policy cadernos_editar on public.cadernos for update to authenticated
  using (public.is_tutor() and criado_por = auth.uid()) with check (public.is_tutor() and criado_por = auth.uid());
drop policy if exists cadernos_apagar on public.cadernos;
create policy cadernos_apagar on public.cadernos for delete to authenticated
  using (public.is_tutor() and criado_por = auth.uid());

-- Tentativas: cada um grava e vê as próprias; o tutor vê as dos alunos vinculados.
drop policy if exists tentativas_ler on public.tentativas;
create policy tentativas_ler on public.tentativas for select to authenticated
  using (user_id = auth.uid() or public.eh_meu_aluno(user_id));
-- Ninguém grava tentativa direto: só pela função entregar(), que corrige no banco.
drop policy if exists tentativas_criar on public.tentativas;
revoke insert, update on public.tentativas from authenticated, anon;
drop policy if exists tentativas_apagar on public.tentativas;
create policy tentativas_apagar on public.tentativas for delete to authenticated
  using (public.eh_meu_aluno(user_id));

-- ---------- Gabarito protegido ----------
-- A coluna itens tem as respostas certas, então o app não a lê diretamente.
-- Quem responde recebe os itens sem gabarito (itens_para_responder); a resposta
-- de um item só sai quando o aluno confere (conferir_item) ou entrega (entregar).
revoke select on public.cadernos from authenticated, anon;
grant select (id, titulo, descricao, contextos, total_itens, criado_por, criado_em, atualizado_em)
  on public.cadernos to authenticated;

-- Itens do caderno, se quem está logado pode vê-lo (autor ou aluno do autor).
create or replace function public.itens_visiveis(p_caderno uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select itens from public.cadernos
  where id = p_caderno and (criado_por = auth.uid() or criado_por = public.meu_tutor());
$$;

-- Mesma regra do app (temGabarito): discursiva sempre; objetiva se a resposta é uma das opções.
create or replace function public.item_tem_gabarito(q jsonb)
returns boolean language sql immutable as $$
  select q ->> 'tipo' = 'open' or (
    coalesce(q ->> 'resposta', 'X') <> 'X'
    and exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(q -> 'opcoes') = 'array' then q -> 'opcoes' else '[]'::jsonb end) o
      where o ->> 'key' = q ->> 'resposta'
    )
  );
$$;

-- Itens sem as respostas, com um campo "gabarito" dizendo se o item conta na nota.
create or replace function public.itens_para_responder(p_caderno uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg((q - 'resposta' - 'resposta_texto') || jsonb_build_object('gabarito', public.item_tem_gabarito(q)) order by n), '[]'::jsonb)
  from jsonb_array_elements(coalesce(public.itens_visiveis(p_caderno), '[]'::jsonb)) with ordinality as e(q, n);
$$;

-- Gabarito de um item (modo estudo e "ver resposta" das discursivas).
create or replace function public.conferir_item(p_caderno uuid, p_item text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('resposta', q -> 'resposta', 'resposta_texto', q -> 'resposta_texto')
  from jsonb_array_elements(coalesce(public.itens_visiveis(p_caderno), '[]'::jsonb)) q
  where q ->> 'id' = p_item
  limit 1;
$$;

-- Caderno completo, com gabarito: só para o tutor que o criou (tela de edição).
create or replace function public.caderno_completo(p_caderno uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select itens from public.cadernos where id = p_caderno and criado_por = auth.uid();
$$;

-- Corrige e grava uma tentativa. Devolve o id e o gabarito dos itens respondidos.
create or replace function public.entregar(p_caderno uuid, p_modo text, p_itens text[], p_respostas jsonb, p_segundos int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_itens jsonb;
  v_item text;
  q jsonb;
  r text;
  v_status text;
  v_usados text[] := '{}';
  v_respostas jsonb := '{}'::jsonb;
  v_resultado jsonb := '{}'::jsonb;
  v_gabarito jsonb := '[]'::jsonb;
  n_ac int := 0; n_er int := 0; n_br int := 0; n_sg int := 0;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login para entregar.'; end if;
  if p_modo not in ('estudo', 'simulado') then raise exception 'Modo inválido.'; end if;
  -- Limites contra abuso: tamanho da prova e entregas seguidas.
  if cardinality(p_itens) > 1000 or pg_column_size(p_respostas) > 200000 then
    raise exception 'Prova grande demais.';
  end if;
  if (select count(*) from public.tentativas where user_id = auth.uid() and feita_em > now() - interval '1 minute') >= 10 then
    raise exception 'Muitas entregas seguidas. Espere um minuto e tente de novo.';
  end if;
  v_itens := public.itens_visiveis(p_caderno);
  if v_itens is null then raise exception 'Caderno não encontrado.'; end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' then p_respostas := '{}'::jsonb; end if;

  foreach v_item in array coalesce(p_itens, '{}') loop
    continue when v_item = any(v_usados);
    q := (select x from jsonb_array_elements(v_itens) x where x ->> 'id' = v_item limit 1);
    continue when q is null;
    v_usados := v_usados || v_item;

    r := p_respostas ->> v_item;
    if q ->> 'tipo' = 'open' then
      if r is distinct from '=ok' and r is distinct from '=bad' then r := null; end if;
    elsif r is not null and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(q -> 'opcoes') = 'array' then q -> 'opcoes' else '[]'::jsonb end) o
      where o ->> 'key' = r
    ) then
      r := null;
    end if;

    if not public.item_tem_gabarito(q) then v_status := 'void'; n_sg := n_sg + 1;
    elsif r is null then v_status := 'blank'; n_br := n_br + 1;
    elsif (q ->> 'tipo' = 'open' and r = '=ok') or r = q ->> 'resposta' then v_status := 'ok'; n_ac := n_ac + 1;
    else v_status := 'bad'; n_er := n_er + 1;
    end if;

    if r is not null then v_respostas := v_respostas || jsonb_build_object(v_item, r); end if;
    v_resultado := v_resultado || jsonb_build_object(v_item, v_status);
    v_gabarito := v_gabarito || jsonb_build_array(jsonb_build_object('id', v_item, 'resposta', q -> 'resposta', 'resposta_texto', q -> 'resposta_texto'));
  end loop;

  if cardinality(v_usados) = 0 then raise exception 'Nenhum item válido para entregar.'; end if;

  insert into public.tentativas (caderno_id, user_id, modo, itens, respostas, acertos, erros, brancos, sem_gabarito, total, segundos, resultado)
  values (p_caderno, auth.uid(), p_modo, to_jsonb(v_usados), v_respostas, n_ac, n_er, n_br, n_sg, cardinality(v_usados),
          greatest(0, least(coalesce(p_segundos, 0), 86400)), v_resultado)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'gabarito', v_gabarito);
end;
$$;

-- ---------- Convite: o aluno entra na turma do tutor com um código ----------
alter table public.profiles add column if not exists codigo_convite text unique;

-- Códigos errados digitados, para travar quem tenta adivinhar. Só as funções mexem aqui.
create table if not exists public.convite_erros (
  user_id uuid not null references auth.users on delete cascade,
  em timestamptz not null default now()
);
create index if not exists convite_erros_idx on public.convite_erros (user_id, em);
alter table public.convite_erros enable row level security;
revoke all on public.convite_erros from anon, authenticated;

-- Código do tutor logado. Cria na primeira vez; p_novo = true troca por outro (o antigo para de valer).
create or replace function public.meu_codigo_convite(p_novo boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  v text;
  b bytea;
begin
  if not public.is_tutor() then raise exception 'Só tutores têm código de convite.'; end if;
  select codigo_convite into v from public.profiles where id = auth.uid();
  if v is null or p_novo then
    loop
      -- gen_random_uuid() usa o gerador criptográfico do Postgres (random() é previsível).
      b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      v := '';
      for i in 0..5 loop
        v := v || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + get_byte(b, i) % 32, 1);
      end loop;
      exit when not exists (select 1 from public.profiles where codigo_convite = v);
    end loop;
    update public.profiles set codigo_convite = v where id = auth.uid();
  end if;
  return v;
end;
$$;

-- Vincula quem está logado ao tutor dono do código. Devolve o nome do tutor,
-- ou null se o código estiver errado (sem exceção, para o erro ficar registrado).
create or replace function public.vincular_tutor(p_codigo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_tutor uuid;
  v_nome text;
begin
  if auth.uid() is null then raise exception 'Faça login para usar o código.'; end if;
  if public.is_tutor() then raise exception 'Tutores não se vinculam a outro tutor.'; end if;
  delete from public.convite_erros where user_id = auth.uid() and em < now() - interval '1 day';
  if (select count(*) from public.convite_erros where user_id = auth.uid() and em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos códigos errados. Espere uma hora e tente de novo.';
  end if;
  select id, nome into v_tutor, v_nome from public.profiles
  where codigo_convite = upper(trim(left(p_codigo, 20))) and papel = 'tutor';
  if v_tutor is null then
    insert into public.convite_erros (user_id) values (auth.uid());
    return null;
  end if;
  update public.profiles set tutor_id = v_tutor where id = auth.uid();
  return coalesce(nullif(v_nome, ''), 'seu tutor');
end;
$$;

revoke execute on function public.meu_codigo_convite(boolean) from public, anon;
revoke execute on function public.vincular_tutor(text) from public, anon;
grant execute on function public.meu_codigo_convite(boolean) to authenticated;
grant execute on function public.vincular_tutor(text) to authenticated;

revoke execute on function public.itens_visiveis(uuid) from public, anon, authenticated;
revoke execute on function public.entregar(uuid, text, text[], jsonb, int) from public, anon;
revoke execute on function public.itens_para_responder(uuid) from public, anon;
revoke execute on function public.conferir_item(uuid, text) from public, anon;
revoke execute on function public.caderno_completo(uuid) from public, anon;
grant execute on function public.entregar(uuid, text, text[], jsonb, int) to authenticated;
grant execute on function public.itens_para_responder(uuid) to authenticated;
grant execute on function public.conferir_item(uuid, text) to authenticated;
grant execute on function public.caderno_completo(uuid) to authenticated;

-- =====================================================================
-- Depois de criar a SUA conta pelo site, rode isto trocando o e-mail
-- para virar tutor:
--
--   update public.profiles set papel = 'tutor'
--   where id = (select id from auth.users where email = 'seu@email.com');
--
-- O aluno se vincula ao tutor pelo código de convite (tela Desempenho do tutor).
-- Se preferir fazer à mão:
--
--   update public.profiles
--   set tutor_id = (select id from auth.users where email = 'tutor@email.com')
--   where id = (select id from auth.users where email = 'aluno@email.com');
-- =====================================================================
